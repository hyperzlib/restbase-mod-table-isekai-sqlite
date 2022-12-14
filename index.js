'use strict';

/*
 * MySQL-backed table storage service
 */

// global includes
const spec = require('restbase-mod-table-spec').spec;

class RBMySQL {
    constructor(options) {
        this.options = options;
        this.conf = options.conf;
        this.log = () => {};
        this.setup = this.setup.bind(this);
        this.store = null;
        this.handler = {
            spec,
            operations: {
                createTable: this.createTable.bind(this),
                dropTable: this.dropTable.bind(this),
                getTableSchema: this.getTableSchema.bind(this),
                get: this.get.bind(this),
                put: this.put.bind(this),
                delete: this.delete.bind(this)
            }
        };
    }

    createTable(rb, req) {
        const store = this.store;

        req.body.table = req.params.table;
        const domain = req.params.domain;

        // check if the domains table exists
        return store.createTable(domain, req.body)
        .then(() => ({
            // created
            status: 201,

            body: {
                type: 'table_created',
                title: 'Table was created.',
                domain: req.params.domain,
                table: req.params.table
            }
        }))
        .catch((e) => {
            this.log('mysql/error', e);
            if (e.status >= 400) {
                return {
                    status: e.status,
                    body: e.body
                };
            }
            return {
                status: 500,
                body: {
                    type: 'table_creation_error',
                    title: 'Internal error while creating a ' +
                        'table within the MySQL storage backend',
                    stack: e.stack,
                    err: e,
                    req
                }
            };
        });
    }

    encodeKey(inputBody) {
        /*let body = {...inputBody};
        if (body && body.attributes) {
            let attr = body.attributes;
            if (attr.title) {
                attr.title = encodeURI(attr.title);
            }
            if (attr.key) {
                attr.key = encodeURI(attr.key);
            }
        }
        return body;*/
        return inputBody;
    }

    // Query a table
    get(rb, req) {
        const rp = req.params;
        if (!rp.rest && !req.body) {
            req.body = {
                table: rp.table,
                limit: 10
            };
        }
        const domain = req.params.domain;
        const body = this.encodeKey(req.body);
        return this.store.get(domain, body)
        .then((res) => {
            return {
                status: res.items.length ? 200 : 404,
                body: res
            };
        })
        .catch((e) => {
            this.log('mysql/error', e);
            return {
                status: 500,
                body: {
                    type: 'query_error',
                    title: 'Error in MySQL table storage backend',
                    stack: e.stack,
                    err: e,
                    req
                }
            };
        });
    }

    // Update a table
    put(rb, req) {
        const domain = req.params.domain;
        const body = this.encodeKey(req.body);
        return this.store.put(domain, body)
        .then(() => ({
            // created
            status: 201
        }))
        .catch((e) => {
            this.log('mysql/error', e);
            return {
                status: 500,
                body: {
                    type: 'update_error',
                    title: 'Internal error in MySQL table storage backend',
                    stack: e.stack,
                    err: e,
                    req
                }
            };
        });
    }

    dropTable(rb, req) {
        const domain = req.params.domain;
        return this.store.dropTable(domain, req.params.table)
        .then(() => ({
            // done
            status: 204
        }))
        .catch((e) => {
            this.log('mysql/error', e);
            return {
                status: 500,
                body: {
                    type: 'delete_error',
                    title: 'Internal error in MySQL table storage backend',
                    stack: e.stack,
                    err: e,
                    req
                }
            };
        });
    }

    getTableSchema(rb, req) {
        const domain = req.params.domain;
        return this.store.getTableSchema(domain, req.params.table)
        .then((res) => ({
            status: 200,
            body: res.schema
        }))
        .catch((e) => {
            this.log('mysql/error', e);
            return {
                status: 500,
                body: {
                    type: 'schema_query_error',
                    title: 'Internal error querying table schema in MySQL storage backend',
                    stack: e.stack,
                    err: e,
                    req
                }
            };
        });
    }

    delete(rb, req) {
        const domain = req.params.domain;
        const body = this.encodeKey(req.body);
        // XXX: Use the path to determine the primary key?
        return this.store.delete(domain, body)
        .thenReturn({
            // deleted
            status: 204
        })
        .catch((e) => ({
            status: 500,
            body: {
                type: 'delete_error',
                title: 'Internal error in MySQL table storage backend',
                stack: e.stack,
                err: e,
                req: {
                    uri: req.uri,
                    headers: req.headers,
                    body: req.body && JSON.stringify(req.body).slice(0, 200)
                }
            }
        }));
    }

    /*
     * Setup / startup
     *
     * @return {Promise<registry>}
     */
    setup() {
        // Set up storage backend
        const createDB = require('./lib/db');
        return createDB(this.options)
        .then((store) => {
            this.store = store;
            return this.handler;
        });
    }
}

/**
 * Factory
 * @param {Object} options
 * @return {Promise<registration>} with registration being the registration
 * object
 */
function makeRBMySQL(options) {
    const rb = new RBMySQL(options);
    return rb.setup();
}

module.exports = makeRBMySQL;
