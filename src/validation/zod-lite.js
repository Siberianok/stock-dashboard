class ParseContext {
  constructor() {
    this.issues = [];
  }

  addIssue(issue) {
    const path = Array.isArray(issue?.path) ? issue.path : [];
    this.issues.push({
      path,
      message: issue?.message || 'Valor inválido',
    });
  }
}

class ZodError extends Error {
  constructor(issues) {
    super('Zod validation error');
    this.issues = issues;
  }
}

class ZodType {
  constructor() {
    this._refinements = [];
    this._isOptional = false;
  }

  _clone() {
    const clone = Object.create(this.constructor.prototype);
    Object.assign(clone, this);
    clone._refinements = [...this._refinements];
    return clone;
  }

  optional() {
    const clone = this._clone();
    clone._isOptional = true;
    return clone;
  }

  refine(check, message) {
    return this.superRefine((value, ctx) => {
      if (!check(value)) {
        ctx.addIssue({ message: message || 'Valor inválido' });
      }
    });
  }

  superRefine(fn) {
    const clone = this._clone();
    clone._refinements.push(fn);
    return clone;
  }

  _applyRefinements(value, ctx, path) {
    this._refinements.forEach((fn) => {
      fn(value, {
        addIssue: (issue) => {
          ctx.addIssue({
            path: issue?.path ? [...path, ...issue.path] : path,
            message: issue?.message || 'Valor inválido',
          });
        },
      });
    });
  }

  safeParse(input) {
    const ctx = new ParseContext();
    const value = this._parse(input, ctx, [], !this._isOptional);
    if (ctx.issues.length) {
      return { success: false, error: new ZodError(ctx.issues) };
    }
    return { success: true, data: value };
  }

  parse(input) {
    const result = this.safeParse(input);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }
}

class ZodNumber extends ZodType {
  constructor(options = {}) {
    super();
    this._options = options;
    this._min = null;
    this._max = null;
  }

  min(value, message) {
    const clone = this._clone();
    clone._min = { value, message: message || `Debe ser ≥ ${value}` };
    return clone;
  }

  max(value, message) {
    const clone = this._clone();
    clone._max = { value, message: message || `Debe ser ≤ ${value}` };
    return clone;
  }

  _parse(input, ctx, path, required) {
    if (input === undefined || input === null || input === '') {
      if (required) {
        ctx.addIssue({ path, message: this._options.required_error || 'Requerido' });
      }
      return undefined;
    }
    if (typeof input !== 'number' || !Number.isFinite(input)) {
      ctx.addIssue({ path, message: this._options.invalid_type_error || 'Debe ser un número válido' });
      return undefined;
    }
    if (this._min && input < this._min.value) {
      ctx.addIssue({ path, message: this._min.message });
    }
    if (this._max && input > this._max.value) {
      ctx.addIssue({ path, message: this._max.message });
    }
    this._applyRefinements(input, ctx, path);
    return input;
  }
}

class ZodBoolean extends ZodType {
  constructor(options = {}) {
    super();
    this._options = options;
  }

  _parse(input, ctx, path, required) {
    if (input === undefined || input === null) {
      if (required) {
        ctx.addIssue({ path, message: this._options.required_error || 'Requerido' });
      }
      return undefined;
    }
    if (typeof input !== 'boolean') {
      ctx.addIssue({ path, message: this._options.invalid_type_error || 'Debe ser booleano' });
      return undefined;
    }
    this._applyRefinements(input, ctx, path);
    return input;
  }
}

class ZodEnum extends ZodType {
  constructor(values) {
    super();
    this._values = Array.isArray(values) ? values : [];
  }

  _parse(input, ctx, path, required) {
    if (input === undefined || input === null) {
      if (required) {
        ctx.addIssue({ path, message: 'Requerido' });
      }
      return undefined;
    }
    if (typeof input !== 'string') {
      ctx.addIssue({ path, message: 'Debe ser una cadena' });
      return undefined;
    }
    if (!this._values.includes(input)) {
      ctx.addIssue({ path, message: 'Valor no permitido' });
      return undefined;
    }
    return input;
  }
}

class ZodString extends ZodType {
  constructor(options = {}) {
    super();
    this._options = options;
  }

  _parse(input, ctx, path, required) {
    if (input === undefined || input === null) {
      if (required) {
        ctx.addIssue({ path, message: this._options.required_error || 'Requerido' });
      }
      return undefined;
    }
    if (typeof input !== 'string') {
      ctx.addIssue({ path, message: this._options.invalid_type_error || 'Debe ser una cadena' });
      return undefined;
    }
    return input;
  }
}

class ZodObject extends ZodType {
  constructor(shape) {
    super();
    this._shape = shape || {};
  }

  _parse(input, ctx, path, required) {
    if (input === undefined || input === null) {
      if (required) {
        ctx.addIssue({ path, message: 'Requerido' });
      }
      return {};
    }
    if (typeof input !== 'object' || Array.isArray(input)) {
      ctx.addIssue({ path, message: 'Debe ser un objeto' });
      return {};
    }
    const result = {};
    Object.entries(this._shape).forEach(([key, schema]) => {
      const value = schema._parse(input[key], ctx, [...path, key], true);
      if (value !== undefined) {
        result[key] = value;
      }
    });
    this._applyRefinements(result, ctx, path);
    return result;
  }
}

class ZodRecord extends ZodType {
  constructor(keySchema, valueSchema) {
    super();
    this._keySchema = keySchema;
    this._valueSchema = valueSchema;
  }

  _parse(input, ctx, path, required) {
    if (input === undefined || input === null) {
      if (required) {
        ctx.addIssue({ path, message: 'Requerido' });
      }
      return {};
    }
    if (typeof input !== 'object' || Array.isArray(input)) {
      ctx.addIssue({ path, message: 'Debe ser un objeto' });
      return {};
    }
    const result = {};
    Object.keys(input).forEach((key) => {
      const keyCheck = this._keySchema._parse(key, ctx, [...path, key], true);
      if (keyCheck === undefined) {
        return;
      }
      const value = this._valueSchema._parse(input[key], ctx, [...path, key], true);
      if (value !== undefined) {
        result[key] = value;
      }
    });
    this._applyRefinements(result, ctx, path);
    return result;
  }
}

export const z = {
  number: (options) => new ZodNumber(options),
  boolean: (options) => new ZodBoolean(options),
  enum: (values) => new ZodEnum(values),
  string: (options) => new ZodString(options),
  object: (shape) => new ZodObject(shape),
  record: (keySchema, valueSchema) => new ZodRecord(keySchema, valueSchema),
};

export { ZodError };
