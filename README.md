# node-dns-changer

### Description
A multiplatform (Linux, Windows, macOS) DNS library for changing DNS servers written in NodeJS.

## Installing
```bash
$ npm i node-dns-changer
```

## Usage
Standard usage:
```javascript
var dns-changer = require('node-dns-changer');

// set DNS servers with backup file of 'dnsBackup'
dns-changer.setDNSserver({
	DNSservers:['8.8.8.8','8.8.4.4'],
	DNSbackupName:'dnsBackup'
});

// restore settings with logging enabled
dns-changer.restoreDNSserver({
	DNSbackupName:'dnsBackup',
	loggingEnable:true
});
```
