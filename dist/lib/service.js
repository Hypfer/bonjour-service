"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const os_1 = __importDefault(require("os"));
const events_1 = require("events");
const service_types_1 = require("./service-types");
const dns_txt_1 = __importDefault(require("./dns-txt"));
const TLD = '.local';
class Service extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.probe = true;
        this.published = false;
        this.activated = false;
        this.destroyed = false;
        this.txtService = new dns_txt_1.default();
        this.name = config.name;
        this.protocol = config.protocol || 'tcp';
        this.type = service_types_1.toString({ name: config.type, protocol: this.protocol });
        this.port = config.port;
        this.host = config.host || os_1.default.hostname();
        this.fqdn = `${this.name}.${this.type}${TLD}`;
        this.txt = config.txt;
        this.subtypes = config.subtypes;
    }
    records() {
        var records = [this.RecordPTR(this), this.RecordSRV(this), this.RecordTXT(this)];
        let ifaces = Object.values(os_1.default.networkInterfaces());
        for (let iface of ifaces) {
            let addrs = iface;
            for (let addr of addrs) {
                if (addr.internal)
                    continue;
                switch (addr.family) {
                    case 'IPv4':
                        records.push(this.RecordA(this, addr.address));
                        break;
                    case 'IPv6':
                        records.push(this.RecordAAAA(this, addr.address));
                        break;
                }
            }
        }
        return records;
    }
    RecordPTR(service) {
        return {
            name: `${service.type}${TLD}`,
            type: 'PTR',
            ttl: 28800,
            data: service.fqdn
        };
    }
    RecordSRV(service) {
        return {
            name: service.fqdn,
            type: 'SRV',
            ttl: 120,
            data: {
                port: service.port,
                target: service.host
            }
        };
    }
    RecordTXT(service) {
        return {
            name: service.fqdn,
            type: 'TXT',
            ttl: 4500,
            data: this.txtService.encode(service.txt)
        };
    }
    RecordA(service, ip) {
        return {
            name: service.host,
            type: 'A',
            ttl: 120,
            data: ip
        };
    }
    RecordAAAA(service, ip) {
        return {
            name: service.host,
            type: 'AAAA',
            ttl: 120,
            data: ip
        };
    }
}
exports.Service = Service;
exports.default = Service;
//# sourceMappingURL=service.js.map