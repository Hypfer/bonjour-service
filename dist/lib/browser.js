"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Browser = void 0;
const events_1 = __importDefault(require("events"));
const service_types_1 = require("./service-types");
const dns_txt_1 = __importDefault(require("./dns-txt"));
const dnsEqual = require('dns-equal');
const TLD = '.local';
const WILDCARD = '_services._dns-sd._udp' + TLD;
class Browser extends events_1.default {
    constructor(mdns, opts, onup) {
        super();
        this.onresponse = null;
        this.serviceMap = {};
        this.wildcard = false;
        this.services = [];
        if (typeof opts === 'function')
            return new Browser(mdns, null, opts);
        this.mdns = mdns;
        if (opts != null && opts.txt != null) {
            this.txt = new dns_txt_1.default(opts.txt);
        }
        else {
            this.txt = new dns_txt_1.default();
        }
        if (!opts || !opts.type) {
            this.name = WILDCARD;
            this.wildcard = true;
        }
        else {
            this.name = service_types_1.toString({ name: opts.type, protocol: opts.protocol || 'tcp' }) + TLD;
            if (opts.name)
                this.name = opts.name + '.' + this.name;
            this.wildcard = false;
        }
        if (onup)
            this.on('up', onup);
        this.start();
    }
    start() {
        if (this.onresponse || this.name === undefined)
            return;
        var self = this;
        var nameMap = {};
        if (!this.wildcard)
            nameMap[this.name] = true;
        this.onresponse = (packet, rinfo) => {
            if (self.wildcard) {
                packet.answers.forEach((answer) => {
                    if (answer.type !== 'PTR' || answer.name !== self.name || answer.name in nameMap)
                        return;
                    nameMap[answer.data] = true;
                    self.mdns.query(answer.data, 'PTR');
                });
            }
            Object.keys(nameMap).forEach(function (name) {
                self.goodbyes(name, packet).forEach(self.removeService.bind(self));
                var matches = self.buildServicesFor(name, packet, self.txt, rinfo);
                if (matches.length === 0)
                    return;
                matches.forEach((service) => {
                    if (self.serviceMap[service.fqdn])
                        return;
                    self.addService(service);
                });
            });
        };
        this.mdns.on('response', this.onresponse);
        this.update();
    }
    stop() {
        if (!this.onresponse)
            return;
        this.mdns.removeListener('response', this.onresponse);
        this.onresponse = null;
    }
    update() {
        this.mdns.query(this.name, 'PTR');
    }
    addService(service) {
        this.services.push(service);
        this.serviceMap[service.fqdn] = true;
        this.emit('up', service);
    }
    removeService(fqdn) {
        var service, index;
        this.services.some(function (s, i) {
            if (dnsEqual(s.fqdn, fqdn)) {
                service = s;
                index = i;
                return true;
            }
        });
        if (!service || index === undefined)
            return;
        this.services.splice(index, 1);
        delete this.serviceMap[fqdn];
        this.emit('down', service);
    }
    goodbyes(name, packet) {
        return packet.answers.concat(packet.additionals)
            .filter((rr) => rr.type === 'PTR' && rr.ttl === 0 && dnsEqual(rr.name, name))
            .map((rr) => rr.data);
    }
    buildServicesFor(name, packet, txt, referer) {
        var records = packet.answers.concat(packet.additionals).filter((rr) => rr.ttl > 0);
        return records
            .filter((rr) => rr.type === 'PTR' && dnsEqual(rr.name, name))
            .map((ptr) => {
            var service = {
                addresses: []
            };
            records
                .filter((rr) => {
                return (rr.type === 'SRV' || rr.type === 'TXT') && dnsEqual(rr.name, ptr.data);
            })
                .forEach((rr) => {
                if (rr.type === 'SRV') {
                    var parts = rr.name.split('.');
                    var name = parts[0];
                    var types = service_types_1.toType(parts.slice(1, -1).join('.'));
                    service.name = name;
                    service.fqdn = rr.name;
                    service.host = rr.data.target;
                    service.referer = referer;
                    service.port = rr.data.port;
                    service.type = types.name;
                    service.protocol = types.protocol;
                    service.subtypes = types.subtypes;
                }
                else if (rr.type === 'TXT') {
                    service.rawTxt = rr.data;
                    service.txt = this.txt.decodeAll(rr.data);
                }
            });
            if (!service.name)
                return;
            records
                .filter((rr) => (rr.type === 'A' || rr.type === 'AAAA') && dnsEqual(rr.name, service.host))
                .forEach((rr) => service.addresses.push(rr.data));
            return service;
        })
            .filter((rr) => !!rr);
    }
}
exports.Browser = Browser;
exports.default = Browser;
//# sourceMappingURL=browser.js.map