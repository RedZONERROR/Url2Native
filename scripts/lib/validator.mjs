import fs from "node:fs";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label} contains invalid JSON: ${err.message}`);
  }
}

function getType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateAgainstSchema(value, schema, pointer, errors) {
  if (schema.type) {
    const actualType = getType(value);
    if (actualType !== schema.type) {
      errors.push(`${pointer}: expected ${schema.type}, got ${actualType}`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${pointer}: must be one of [${schema.enum.join(", ")}], got "${value}"`);
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${pointer}: length must be at least ${schema.minLength}`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push(`${pointer}: length must be at most ${schema.maxLength}`);
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`${pointer}: value "${value}" does not match required pattern ${schema.pattern}`);
      }
    }
    if (schema.format === "uri") {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          errors.push(`${pointer}: URL protocol must be http: or https:, got "${parsed.protocol}"`);
        }
      } catch {
        errors.push(`${pointer}: invalid URL "${value}"`);
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${pointer}: array cannot have more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateAgainstSchema(item, schema.items, `${pointer}[${index}]`, errors);
      });
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const props = schema.properties || {};
    const required = schema.required || [];

    for (const reqKey of required) {
      if (!(reqKey in value)) {
        errors.push(`${pointer}.${reqKey}: missing required property`);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) {
          errors.push(`${pointer}.${key}: unknown property is not allowed`);
        }
      }
    }

    for (const [key, propSchema] of Object.entries(props)) {
      if (key in value) {
        validateAgainstSchema(value[key], propSchema, `${pointer}.${key}`, errors);
      }
    }

    if (Array.isArray(schema.oneOf)) {
      let satisfiedCount = 0;
      for (const branch of schema.oneOf) {
        const branchErrors = [];
        validateAgainstSchema(value, branch, pointer, branchErrors);
        if (branchErrors.length === 0) {
          satisfiedCount += 1;
        }
      }
      if (satisfiedCount !== 1) {
        errors.push(
          `${pointer}: must specify exactly one of [${schema.oneOf
            .map((b) => (b.required || []).join("+"))
            .join(" | ")}]`
        );
      }
    }
  }
}

function inspectPng(iconPath) {
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Master icon file not found at: ${iconPath}`);
  }
  const buffer = fs.readFileSync(iconPath);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Master icon "${iconPath}" is not a valid PNG file.`);
  }
  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    throw new Error(`Master icon "${iconPath}" is missing an IHDR header chunk.`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];

  if (width < 128 || height < 128) {
    throw new Error(
      `Master icon dimensions (${width}x${height}) are too small. Provide at least 128x128 (recommended: 1024x1024).`
    );
  }
  if (width !== height) {
    throw new Error(
      `Master icon must be square (got ${width}x${height}). Recommended size is 1024x1024.`
    );
  }
  if (bitDepth !== 8) {
    throw new Error(
      `Master icon PNG bit depth must be 8-bit per channel (got ${bitDepth}-bit).`
    );
  }

  return {
    absolutePath: iconPath,
    width,
    height,
    bitDepth,
    colorType
  };
}

export function validateConfig({ rootDir, configPath, schemaPath }) {
  const config = readJsonFile(configPath, "app.config.json");
  const schema = readJsonFile(schemaPath, "app.config.schema.json");

  const errors = [];
  validateAgainstSchema(config, schema, "$", errors);

  if (config?.userAgent?.mode && config.userAgent.mode !== "default") {
    if (!config.userAgent.value || config.userAgent.value.trim().length === 0) {
      errors.push(
        `$.userAgent.value: must be non-empty when userAgent.mode is "${config.userAgent.mode}"`
      );
    }
  }

  if (config?.app?.packageId) {
    const segments = config.app.packageId.split(".");
    const reserved = new Set([
      "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
      "class", "const", "continue", "default", "do", "double", "else", "enum",
      "extends", "final", "finally", "float", "for", "goto", "if", "implements",
      "import", "instanceof", "int", "interface", "long", "native", "new",
      "package", "private", "protected", "public", "return", "short", "static",
      "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
      "transient", "try", "void", "volatile", "while"
    ]);
    for (const seg of segments) {
      if (reserved.has(seg)) {
        errors.push(`$.app.packageId: segment "${seg}" is a reserved Java keyword`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n  - ${errors.join("\n  - ")}`);
  }

  const resolvedIconPath = path.resolve(rootDir, config.app.icon);
  const iconInfo = inspectPng(resolvedIconPath);

  return { config, iconInfo };
}
