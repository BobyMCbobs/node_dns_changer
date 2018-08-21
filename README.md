# node_dns_changer

### Description
A multiplatform (Linux, Windows, macOS) DNS library for changing DNS servers written in NodeJS.

## Installing
```bash
$ npm i node_dns_changer
```

## Usage
Standard usage:
```javascript
var dns_changer = require('node_dns_changer');

// set DNS servers with backup file of 'dnsBackup'
dns_changer.setDNSserver({
	DNSservers:['8.8.8.8','8.8.4.4'],
	DNSbackupName:'dnsBackup'
});

// restore settings with logging enabled
dns_changer.restoreDNSserver({
	DNSbackupName:'dnsBackup',
	loggingEnable:true
});
```
## How it works
### Installation
On Linux, /etc/resolv.conf is moved to /etc/resolv.conf.(backupname), then writes a new file (which is made immutible) in the original place with new DNS nameservers, finally the DNS cache is flushed to affirm changes.  
On Windows, DNS settings are applied to all ethernet and wireless interfaces, finally the DNS cache is flushed to affirm changes.  
On macOS, DNS settings are applied to all network interfaces, finally the DNS cache is flushed to affirm changes.  

### Restoration
On Linux, /etc/resolv.conf is made mutible, /etc/resolv.conf/.(backnane) is moved over /etc/resolv.conf, finally the DNS cache is flushed to affirm changes.  
On Windows, All ethernet and wireless interfaces are told to fetch DNS settings from DHCP, finally the DNS cache is flushed to affirm changes.  
On macOS, DNS addresses are retrieved from the backup made during installation and are set on all network interfaces, finally the DNS cache is flushed to affirm changes.  
