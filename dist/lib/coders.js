"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCoder = exports.dateCoder = exports.regexCoder = exports.jsonCoder = exports.bitmask32Coder = exports.bitmask16Coder = exports.bitmask8Coder = exports.booleanArrayCoder = exports.booleanCoder = exports.BufferCoder = exports.stringCoder = exports.float32Coder = exports.float64Coder = exports.intCoder = exports.uintCoder = void 0;
/* ---------------------------
 Binary Coder Implementations
 --------------------------- */
// Stores 2^i from i=0 to i=56
const POW = (function () {
    var r = [], i, n = 1;
    for (i = 0; i <= 56; i++) {
        r.push(n);
        n *= 2;
    }
    return r;
})();
// Pre-calculated constants
const MAX_DOUBLE_INT = POW[53], MAX_UINT8 = POW[7], MAX_UINT16 = POW[14], MAX_UINT32 = POW[29], MAX_INT8 = POW[6], MAX_INT16 = POW[13], MAX_INT32 = POW[28];
/**
 * Formats (big-endian):
 * 7b  0xxx xxxx
 * 14b  10xx xxxx  xxxx xxxx
 * 29b  110x xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx
 * 61b  111x xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx
 */
exports.uintCoder = {
    write: function (u, data, path) {
        // Check the input
        if (Math.round(u) !== u || u > MAX_DOUBLE_INT || u < 0) {
            throw new TypeError('Expected unsigned integer at ' + path + ', got ' + u);
        }
        if (u < MAX_UINT8) {
            data.writeUInt8(u);
        }
        else if (u < MAX_UINT16) {
            data.writeUInt16(u + 0x8000);
        }
        else if (u < MAX_UINT32) {
            data.writeUInt32(u + 0xc0000000);
        }
        else {
            // Split in two 32b uints
            data.writeUInt32(Math.floor(u / POW[32]) + 0xe0000000);
            data.writeUInt32(u >>> 0);
        }
    },
    read: function (state) {
        var firstByte = state.peekUInt8();
        if (!(firstByte & 0x80)) {
            state.incrementOffset();
            return firstByte;
        }
        else if (!(firstByte & 0x40)) {
            return state.readUInt16() - 0x8000;
        }
        else if (!(firstByte & 0x20)) {
            return state.readUInt32() - 0xc0000000;
        }
        else {
            return (state.readUInt32() - 0xe0000000) * POW[32] + state.readUInt32();
        }
    }
};
/**
 * Same format as uint
 */
exports.intCoder = {
    write: function (i, data, path) {
        // Check the input
        if (Math.round(i) !== i || i > MAX_DOUBLE_INT || i < -MAX_DOUBLE_INT) {
            throw new TypeError('Expected signed integer at ' + path + ', got ' + i);
        }
        if (i >= -MAX_INT8 && i < MAX_INT8) {
            data.writeUInt8(i & 0x7f);
        }
        else if (i >= -MAX_INT16 && i < MAX_INT16) {
            data.writeUInt16((i & 0x3fff) + 0x8000);
        }
        else if (i >= -MAX_INT32 && i < MAX_INT32) {
            data.writeUInt32((i & 0x1fffffff) + 0xc0000000);
        }
        else {
            // Split in two 32b uints
            data.writeUInt32((Math.floor(i / POW[32]) & 0x1fffffff) + 0xe0000000);
            data.writeUInt32(i >>> 0);
        }
    },
    read: function (state) {
        var firstByte = state.peekUInt8(), i;
        if (!(firstByte & 0x80)) {
            state.incrementOffset();
            return (firstByte & 0x40) ? (firstByte | 0xffffff80) : firstByte;
        }
        else if (!(firstByte & 0x40)) {
            i = state.readUInt16() - 0x8000;
            return (i & 0x2000) ? (i | 0xffffc000) : i;
        }
        else if (!(firstByte & 0x20)) {
            i = state.readUInt32() - 0xc0000000;
            return (i & 0x10000000) ? (i | 0xe0000000) : i;
        }
        else {
            i = state.readUInt32() - 0xe0000000;
            i = (i & 0x10000000) ? (i | 0xe0000000) : i;
            return i * POW[32] + state.readUInt32();
        }
    }
};
/**
 * 64-bit double precision float
 */
exports.float64Coder = {
    write: function (f, data, path) {
        if (typeof f !== 'number') {
            throw new TypeError('Expected a number at ' + path + ', got ' + f);
        }
        data.writeDouble(f);
    },
    read: function (state) {
        return state.readDouble();
    }
};
/**
 * 32-bit single precision float
 */
exports.float32Coder = {
    write: function (f, data, path) {
        if (typeof f !== 'number') {
            throw new TypeError('Expected a number at ' + path + ', got ' + f);
        }
        data.writeFloat(f);
    },
    read: function (state) {
        return state.readFloat();
    }
};
/**
 * <uint_length> <buffer_data>
 */
exports.stringCoder = {
    write: function (s, data, path) {
        if (typeof s !== 'string') {
            throw new TypeError('Expected a string at ' + path + ', got ' + s);
        }
        exports.BufferCoder.write(Buffer.from(s), data, path);
    },
    read: function (state) {
        return exports.BufferCoder.read(state).toString();
    }
};
/**
 * <uint_length> <buffer_data>
 */
exports.BufferCoder = {
    write: function (B, data, path) {
        if (!Buffer.isBuffer(B)) {
            throw new TypeError('Expected a Buffer at ' + path + ', got ' + B);
        }
        exports.uintCoder.write(B.length, data, path);
        data.appendBuffer(B);
    },
    read: function (state) {
        var length = exports.uintCoder.read(state);
        return state.readBuffer(length);
    }
};
/**
 * either 0x00 or 0x01
 */
exports.booleanCoder = {
    write: function (b, data, path) {
        if (typeof b !== 'boolean') {
            throw new TypeError('Expected a boolean at ' + path + ', got ' + b);
        }
        data.writeUInt8(b ? 1 : 0);
    },
    read: function (state) {
        var b = state.readUInt8();
        if (b > 1) {
            throw new Error('Invalid boolean value');
        }
        return Boolean(b);
    }
};
/** Encode arbitrary boolean arrays as UInt8s. */
exports.booleanArrayCoder = {
    write: function (b, data, path) {
        if (!Array.isArray(b)) {
            throw new TypeError('Expected a boolean array at ' + path + ', got ' + b);
        }
        const chunkSize = 6;
        for (let i = 0; i < b.length; i += chunkSize) {
            const isFinalChunk = i + chunkSize >= b.length;
            const bools = b.slice(i, i + chunkSize);
            const values = [/* header */ true, isFinalChunk, ...bools];
            const intValue = booleanArrayToInteger(values);
            data.writeUInt8(intValue);
        }
    },
    read: function (state) {
        const values = [];
        let isFinalChunk = false;
        while (!isFinalChunk) {
            const intVal = state.readUInt8();
            const chunk = integerToBooleanArray(intVal);
            chunk.shift(); // pop header
            isFinalChunk = chunk.shift();
            values.push(...chunk);
        }
        return values;
    }
};
/** Encode up to 8 booleans as a UInt8 */
exports.bitmask8Coder = {
    write: function (b, data, path) {
        if (!Array.isArray(b)) {
            throw new TypeError('Expected a boolean array at ' + path + ', got ' + b);
        }
        const intValue = fixedLengthBooleanArrayToInteger(b, 8);
        data.writeUInt8(intValue);
    },
    read: function (state) {
        var intVal = state.readUInt8();
        return integerToFixedLengthBooleanArray(intVal, 8);
    }
};
/** Encode exactly 16 booleans as a UInt16 */
exports.bitmask16Coder = {
    write: function (b, data, path) {
        if (!Array.isArray(b)) {
            throw new TypeError('Expected a boolean array at ' + path + ', got ' + b);
        }
        const intValue = fixedLengthBooleanArrayToInteger(b, 16);
        data.writeUInt16(intValue);
    },
    read: function (state) {
        var intVal = state.readUInt16();
        return integerToFixedLengthBooleanArray(intVal, 16);
    }
};
/** Encode exactly 32 booleans as a UInt32 */
exports.bitmask32Coder = {
    write: function (b, data, path) {
        if (!Array.isArray(b)) {
            throw new TypeError('Expected a boolean array at ' + path + ', got ' + b);
        }
        const intValue = fixedLengthBooleanArrayToInteger(b, 32);
        data.writeUInt32(intValue);
    },
    read: function (state) {
        var intVal = state.readUInt32();
        return integerToFixedLengthBooleanArray(intVal, 32);
    }
};
/**
 * <uint_length> <buffer_data>
 */
exports.jsonCoder = {
    write: function (j, data, path) {
        exports.stringCoder.write(JSON.stringify(j), data, path);
    },
    read: function (state) {
        return JSON.parse(exports.stringCoder.read(state));
    }
};
/**
 * <uint_source_length> <buffer_source_data> <flags>
 * flags is a bit-mask: g=1, i=2, m=4
 */
exports.regexCoder = {
    write: function (r, data, path) {
        var g, i, m;
        if (!(r instanceof RegExp)) {
            throw new TypeError('Expected an instance of RegExp at ' + path + ', got ' + r);
        }
        exports.stringCoder.write(r.source, data, path);
        g = r.global ? 1 : 0;
        i = r.ignoreCase ? 2 : 0;
        m = r.multiline ? 4 : 0;
        data.writeUInt8(g + i + m);
    },
    read: function (state) {
        var source = exports.stringCoder.read(state), flags = state.readUInt8(), g = flags & 0x1 ? 'g' : '', i = flags & 0x2 ? 'i' : '', m = flags & 0x4 ? 'm' : '';
        return new RegExp(source, g + i + m);
    }
};
/**
 * <uint_time_ms>
 */
exports.dateCoder = {
    write: function (d, data, path) {
        if (!(d instanceof Date)) {
            throw new TypeError('Expected an instance of Date at ' + path + ', got ' + d);
        }
        else if (isNaN(d.getTime())) {
            throw new TypeError('Expected a valid Date at ' + path + ', got ' + d);
        }
        exports.uintCoder.write(d.getTime(), data, path);
    },
    read: function (state) {
        return new Date(exports.uintCoder.read(state));
    }
};
/**
 * Encode a boolean array as an integer.
 * Modified version of: https://github.com/geckosio/typed-array-buffer-schema/blob/d1e2330c8910e29280ab59e92619e5019b6405d4/src/serialize.ts#L29
 */
function fixedLengthBooleanArrayToInteger(booleanArray, length) {
    let str = '';
    for (let i = 0; i < length; i++) {
        str += +!!booleanArray[i];
    }
    return parseInt(str, 2);
}
/**
 * Decode a boolean array as an integer.
 * Modified version of: https://github.com/geckosio/typed-array-buffer-schema/blob/d1e2330c8910e29280ab59e92619e5019b6405d4/src/serialize.ts#L39
 */
function integerToFixedLengthBooleanArray(int, length) {
    return [...(int >>> 0).toString(2).padStart(length, '0')].map(e => (e == '0' ? false : true));
}
/**
 * Encode a boolean array as an integer.
 * Modified version of: https://github.com/geckosio/typed-array-buffer-schema/blob/d1e2330c8910e29280ab59e92619e5019b6405d4/src/serialize.ts#L29
 */
function booleanArrayToInteger(booleanArray) {
    let str = '';
    for (let i = 0; i < booleanArray.length; i++) {
        str += +!!booleanArray[i];
    }
    return parseInt(str, 2);
}
/**
 * Decode a boolean array as an integer.
 * Modified version of: https://github.com/geckosio/typed-array-buffer-schema/blob/d1e2330c8910e29280ab59e92619e5019b6405d4/src/serialize.ts#L39
 */
function integerToBooleanArray(int) {
    return [...(int >>> 0).toString(2)].map(e => (e == '0' ? false : true));
}
//
// Coders:
//
/**
 * Helper to get the right coder.
 */
function getCoder(type) {
    switch (type) {
        case "boolean" /* CoderType.BOOLEAN */: return exports.booleanCoder;
        case "Buffer" /* CoderType.BUFFER */: return exports.BufferCoder;
        case "date" /* CoderType.DATE */: return exports.dateCoder;
        case "float32" /* CoderType.FLOAT_32 */: return exports.float32Coder;
        case "float64" /* CoderType.FLOAT_64 */: return exports.float64Coder;
        case "int" /* CoderType.INT */: return exports.intCoder;
        case "json" /* CoderType.JSON */: return exports.jsonCoder;
        case "regex" /* CoderType.REGEX */: return exports.regexCoder;
        case "string" /* CoderType.STRING */: return exports.stringCoder;
        case "uint" /* CoderType.UINT */: return exports.uintCoder;
        case "booleans" /* CoderType.BOOLEAN_ARRAY */: return exports.booleanArrayCoder;
        case "bitmask8" /* CoderType.BITMASK_8 */: return exports.bitmask8Coder;
        case "bitmask16" /* CoderType.BITMASK_16 */: return exports.bitmask16Coder;
        case "bitmask32" /* CoderType.BITMASK_32 */: return exports.bitmask32Coder;
        case "[array]" /* CoderType.ARRAY */,
            "{object}" /* CoderType.OBJECT */:
            // This should not be possible!
            throw new Error(`No binary coder exists for data structure type: "${type}"`);
        default:
            throw new Error(`Unknown binary coder type: "${type}"`);
    }
}
exports.getCoder = getCoder;
//# sourceMappingURL=coders.js.map