"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDB = exports.connectDB = void 0;
const supabase_js_1 = require("./supabase.js");
const connectDB = async () => {
    const { error } = await supabase_js_1.supabase.from('organizers').select('id').limit(1);
    if (error)
        throw new Error(`Supabase connection failed: ${error.message}`);
    console.log('Connected successfully to Supabase PostgreSQL');
    return process.env.SUPABASE_URL || 'supabase';
};
exports.connectDB = connectDB;
const closeDB = async () => {
    // Supabase uses pooled HTTP connections; there is no process-local connection to close.
};
exports.closeDB = closeDB;
