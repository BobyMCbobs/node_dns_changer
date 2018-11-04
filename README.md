# node_dns_changer
A multiplatform (Linux, Windows, macOS) DNS library for changing DNS servers written in NodeJS.

## Notes
- IMPORTANT: Requires root/sudo/admin privileges to adjust any settings.
- DNSbackupName doesn't need to be provided
- Tested on:
	- Linux:
		- openSUSE Leap 15
		- Ubuntu 18.04
		- Fedora 28
	- Windows
	    - 7 (SP1)
	    - 10 (1803, 1809)
	- macOS El Capitan
- May have problems working with Hyper-V switches on Windows

## Installing
```bash
$ npm i node_dns_changer
```

## Usage
Standard usage:
```javascript
const dns_changer = require('node_dns_changer');

// set DNS servers with backup name of 'dnsBackup'
dns_changer.setDNSservers({
	DNSservers: ['8.8.8.8','8.8.4.4'],
	mkBackup: true,
	DNSbackupName: 'dnsBackup'
});

// restore settings with logging enabled
dns_changer.restoreDNSservers({
	DNSbackupName: 'dnsBackup',
	loggingEnable: true,
	rmBackup: true
});

// setup DNS servers without a custom backup name
dns_changer.setDNSservers({
	DNSservers: ['8.8.8.8','8.8.4.4']
});

// restore settings without a custom backup name
dns_changer.restoreDNSservers({});
```

Promises support:
```javascripts
const dns_changer = require('node_dns_changer');

// set DNS servers with backup name of 'dnsBackup'
dns_changer.setDNSservers({
	DNSservers: ['8.8.8.8','8.8.4.4'],
	mkBackup: true,
	DNSbackupName: 'dnsBackup'
}).then((a) => {
    if (a == true) console.log("SUCCEEDED SUCCESSFULLY");
});
```

### Arguments
| Arg | Description | Found in | Data type | Default value |
| - | - | - | - | - |
| DNSservers | A variable in which the DNS servers are inputted | setDNSservers; restoreDNSservers | Array of strings, or a string with a space | null |
| loggingEnable | Log the events as they take place | setDNSservers; restoreDNSservers | boolean | false |
| mkBackup | Make a backup when applicable | setDNSservers | boolean | true |
| rmBackup | Remove a backup when applicable | restoreDNSservers | boolean | false |

## How it works
### Installation
| Platform | Description |
| - | - |
| Linux | 1. /etc/resolv.conf is backed up to /etc/resolv.conf.(backupname) 2. A new /etc/resolv.conf file is written with the given servers 3. /etc/resolv.conf is made immutible 4. DNS cache is flushed. |
| Windows | 1. DNS settings are applied to all ethernet and wireless interfaces 2. DNS cache is flushed. |
| macOS | 1. DNS settings are applied to all network interfaces 2. DNS cache is flushed. |

### Restoration
| Platform | Description |
| - | - |
| Linux | 1. /etc/resolv.conf is made mutible 2. /etc/resolv.conf/.(backupname) is restored to /etc/resolv.conf 3. DNS cache is flushed. |
| Windows | 1. All ethernet and wireless interfaces are told to fetch DNS settings from DHCP 2. DNS cache is flushed. |
| macOS | 1. DNS addresses are retrieved from the backup made during installation and are set on all network interfaces 2. DNS cache is flushed. |

## Test it in Docker
Build: `docker build -t node_dns_changer .`  
Run: `docker run --rm -it node_dns_changer`  
Go to folder: `cd /root/node_dns_changer && node`  
Use:
```javascript
const dns_changer = require('./index.js');

dns_changer.setDNSservers({
	DNSservers: ['8.8.8.8','8.8.4.4'],
	mkBackup: true,
	DNSbackupName: 'dnsBackup',
	loggingEnable: true
});

dns_changer.restoreDNSservers({
	DNSbackupName:'dnsBackup',
	loggingEnable: true,
	rmBackup: true
});
```
