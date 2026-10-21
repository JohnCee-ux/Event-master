"use strict";
// Zero-dependency, instantaneous in-memory database engine matching Mongoose Model API
// Used when Mongo daemon or MongoMemoryServer binary download is unavailable.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryStore = exports.MemoryCollection = void 0;
const crypto_1 = __importDefault(require("crypto"));
class MemoryCollection {
    name;
    items = [];
    constructor(name) {
        this.name = name;
    }
    matchQuery(item, query) {
        if (!query || Object.keys(query).length === 0)
            return true;
        for (const key of Object.keys(query)) {
            const val = query[key];
            if (key === '$or' && Array.isArray(val)) {
                const anyMatch = val.some((subQuery) => this.matchQuery(item, subQuery));
                if (!anyMatch)
                    return false;
                continue;
            }
            if (key === '$in' || (val && typeof val === 'object' && '$in' in val)) {
                const inArray = val.$in || val;
                const itemVal = (item[key] || '').toString();
                const matches = inArray.some((target) => target.toString() === itemVal);
                if (!matches)
                    return false;
                continue;
            }
            if (val && typeof val === 'object') {
                if ('$lt' in val && !(item[key] < val.$lt))
                    return false;
                if ('$exists' in val && (item[key] !== undefined) !== val.$exists)
                    return false;
                if ('$ne' in val) {
                    if (Array.isArray(item[key]) ? item[key].includes(val.$ne) : item[key] === val.$ne)
                        return false;
                    if (val.$ne === null && (item[key] === null || item[key] === undefined))
                        return false;
                    continue;
                }
                if ('$regex' in val) {
                    const regex = new RegExp(val.$regex, val.$options || 'i');
                    if (!regex.test(item[key] || ''))
                        return false;
                    continue;
                }
            }
            const itemFieldVal = item[key] ? item[key].toString() : item[key];
            const targetVal = val ? val.toString() : val;
            if (itemFieldVal !== targetVal) {
                return false;
            }
        }
        return true;
    }
    async findOne(query) {
        const found = this.items.find((item) => this.matchQuery(item, query));
        if (!found)
            return null;
        return this.wrapDoc(found);
    }
    async findOneAndUpdate(query, update) {
        const index = this.items.findIndex((item) => this.matchQuery(item, query));
        if (index < 0)
            return null;
        const changes = update.$set || {};
        const increments = update.$inc || {};
        const additions = update.$addToSet || {};
        const updated = { ...this.items[index], ...changes };
        Object.keys(increments).forEach((key) => {
            updated[key] = (updated[key] || 0) + increments[key];
        });
        Object.keys(additions).forEach((key) => {
            const values = Array.isArray(updated[key]) ? updated[key] : [];
            if (!values.includes(additions[key]))
                values.push(additions[key]);
            updated[key] = values;
        });
        this.items[index] = { ...updated, updatedAt: new Date() };
        return this.wrapDoc(this.items[index]);
    }
    async findById(id) {
        const strId = id ? id.toString() : '';
        const found = this.items.find((item) => item._id === strId);
        if (!found)
            return null;
        return this.wrapDoc(found);
    }
    async countDocuments(query = {}) {
        return this.items.filter((item) => this.matchQuery(item, query)).length;
    }
    async deleteMany(query = {}) {
        const beforeCount = this.items.length;
        this.items = this.items.filter((item) => !this.matchQuery(item, query));
        return { deletedCount: beforeCount - this.items.length };
    }
    async findByIdAndDelete(id) {
        const strId = id ? id.toString() : '';
        const index = this.items.findIndex((item) => item._id === strId);
        if (index < 0)
            return null;
        const removed = this.items.splice(index, 1)[0];
        return this.wrapDoc(removed);
    }
    async deleteOne(query = {}) {
        const index = this.items.findIndex((item) => this.matchQuery(item, query));
        if (index < 0)
            return { deletedCount: 0 };
        this.items.splice(index, 1);
        return { deletedCount: 1 };
    }
    find(query = {}) {
        let results = this.items.filter((item) => this.matchQuery(item, query));
        const queryObj = {
            _sort: null,
            _skip: 0,
            _limit: Infinity,
            sort(sortOptions) {
                queryObj._sort = sortOptions;
                return queryObj;
            },
            skip(count) {
                queryObj._skip = count;
                return queryObj;
            },
            limit(count) {
                queryObj._limit = count;
                return queryObj;
            },
            lean() {
                return queryObj.exec();
            },
            async exec() {
                let list = [...results];
                if (queryObj._sort) {
                    const sortKey = Object.keys(queryObj._sort)[0];
                    const sortDir = queryObj._sort[sortKey];
                    list.sort((a, b) => {
                        const valA = a[sortKey];
                        const valB = b[sortKey];
                        if (valA < valB)
                            return sortDir === 1 ? -1 : 1;
                        if (valA > valB)
                            return sortDir === 1 ? 1 : -1;
                        return 0;
                    });
                }
                if (queryObj._skip > 0) {
                    list = list.slice(queryObj._skip);
                }
                if (queryObj._limit < Infinity) {
                    list = list.slice(0, queryObj._limit);
                }
                return list;
            },
            then(resolve, reject) {
                return queryObj.exec().then(resolve, reject);
            },
        };
        return queryObj;
    }
    async create(data) {
        const _id = data._id ? data._id.toString() : crypto_1.default.randomBytes(12).toString('hex');
        const now = new Date();
        const doc = {
            ...data,
            _id,
            createdAt: data.createdAt || now,
            updatedAt: data.updatedAt || now,
        };
        this.items.push(doc);
        return this.wrapDoc(doc);
    }
    async aggregate(pipeline) {
        let data = [...this.items];
        for (const stage of pipeline) {
            if (stage.$match) {
                data = data.filter((item) => this.matchQuery(item, stage.$match));
            }
            if (stage.$group) {
                const groupKey = stage.$group._id ? stage.$group._id.replace('$', '') : null;
                const groups = {};
                data.forEach((item) => {
                    const k = groupKey ? (item[groupKey] ? item[groupKey].toString() : 'null') : 'all';
                    if (!groups[k]) {
                        groups[k] = { _id: item[groupKey], registeredCount: 0, checkedInCount: 0 };
                    }
                    if (stage.$group.registeredCount) {
                        groups[k].registeredCount += 1;
                    }
                    if (stage.$group.checkedInCount) {
                        if (item.checkedInAt) {
                            groups[k].checkedInCount += 1;
                        }
                    }
                });
                return Object.values(groups);
            }
        }
        return data;
    }
    wrapDoc(raw) {
        const parent = this;
        const doc = { ...raw };
        Object.defineProperty(doc, 'save', {
            value: async function () {
                this.updatedAt = new Date();
                const index = parent.items.findIndex((item) => item._id === this._id);
                if (index >= 0) {
                    parent.items[index] = { ...this };
                }
                else {
                    parent.items.push({ ...this });
                }
                return this;
            },
            enumerable: false,
        });
        return doc;
    }
}
exports.MemoryCollection = MemoryCollection;
exports.memoryStore = {
    organizers: new MemoryCollection('organizers'),
    events: new MemoryCollection('events'),
    attendees: new MemoryCollection('attendees'),
    auditLogs: new MemoryCollection('auditLogs'),
};
