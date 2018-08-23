// node_dns_changer

//
// Copyright (C) 2018 Caleb Woodbine <calebwoodbine.public@gmail.com>
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
//

const exec = require('child_process').exec;
const os = require('os');
const fs = require('fs');
const shell = require('shelljs');
shell.config.silent = true;

var macOSignoreInterfaces = ['iPhone USB', ''];

function _execute(command){
	// execute a system command
	exec(command, function(error, stdout, stderr){
		console.log(stdout);
	});
};

function _getExecutionOutput(command) {
	// return output of a command
	var usercmd;
	try {
		usercmd = shell.exec(command).stdout;
	}
	catch(error) {
		usercmd = exec(command);
	}
	return usercmd;
}

exports.setDNSservers = function({DNSservers, DNSbackupName, loggingEnable}) {
	// set a DNS per platform
	if (loggingEnable == true) console.log('Setting DNS servers:', DNSservers);
	if (DNSservers === undefined) throw "You must include two DNS server addresses";
	if (DNSbackupName === undefined) var DNSbackupName="before-dns-changer";
	switch(os.platform()) {
		case 'linux':
			// move resolv.conf to another location
			if (loggingEnable == true) console.log('Backing up resolv.conf');
			fs.rename('/etc/resolv.conf', String('/etc/resolv.conf.'+DNSbackupName), (err) => {
				if (err) throw err;
				if (loggingEnable == true) console.log('Renamed file.');
			});
			if (loggingEnable == true) console.log('Writing resolv.conf');
			// write new DNS server config
			fs.writeFile('/etc/resolv.conf', String("nameserver "+DNSservers[0]+'\n'+"nameserver "+DNSservers[1]+'\n'), function (err) {
				if (err) throw err;
				if (loggingEnable == true) console.log('Saved file.');
			});
			if (loggingEnable == true) console.log('Changing permissions');
			// make resolv.conf immutable
			_execute('chattr +i /etc/resolv.conf');
			if (loggingEnable == true) console.log('Flushing DNS cache (if systemd-resolve is available).');
			// flush DNS cache
			_getExecutionOutput('which systemd-resolve && systemd-resolve --flush-caches');
			_getExecutionOutput('which nscd && service nscd reload && service nscd restart');
			break;
		case 'darwin':
			// get interfaces
			var interfaces = _getExecutionOutput('networksetup -listallnetworkservices | sed 1,1d');
			interfaces = interfaces.split('\n');
			if (loggingEnable == true) console.log('Backing up current DNS servers');
			// back up current DNS server addresses
			_execute("ipconfig getpacket en0 | perl -ne'/domain_name_server.*: \{(.*)}/ && print join \" \", split /,\s*/, $1' > /Library/Caches/"+DNSbackupName+".txt");
			for (x in interfaces) {
				// set DNS servers, per interface
				if (loggingEnable == true) console.log("Setting interface:", interfaces[x]);
				if (loggingEnable == true) console.log(String('networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers.join(' ')))
				_getExecutionOutput(String('networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers.join(' ')));
			}
			break;
		case 'win32':
			// get interfaces
			var interfaces_ethernet = String(_getExecutionOutput('ipconfig | find /i "Ethernet adapter"').trim().split(' ').slice(2)).replace(':','').split(' ');
			var interfaces_wireless = String(_getExecutionOutput('ipconfig | find /i "Wireless LAN adapter"').trim().split(' ').slice(3)).replace(':','').split(' ');
			if (loggingEnable == true) console.log('ETHERNET  :', interfaces_ethernet);
			if (loggingEnable == true) console.log('WIRELESS :', interfaces_wireless);
			if (/^[0-9a-zA-Z]+$/.test(interfaces_ethernet)) for (x in interfaces_ethernet) {
				// set DNS servers per ethernet interface
				if (loggingEnable == true) console.log('Setting ethernet interface:', interfaces_ethernet[x].trim());
				_execute(String('netsh interface ipv4 set dns name="'+interfaces_ethernet[x]+'" static ' + DNSservers[0] + ' primary'));
				_execute(String('netsh interface ipv4 add dns name="'+interfaces_ethernet[x]+'" ' + DNSservers[1] + ' index=2'));
			}
			if (/^[0-9a-zA-Z]+$/.test(interfaces_wireless)) for (x in interfaces_wireless) {
				// set DNS servers per wireless interface
				if (loggingEnable == true) console.log('Setting wireless interface:', interfaces_wireless[x].trim());
				_execute(String('netsh interface ipv4 set dns name="'+interfaces_wireless[x]+'" static ' + DNSservers[0] + ' primary'));
				_execute(String('netsh interface ipv4 add dns name="'+interfaces_wireless[x]+'" ' + DNSservers[1] + ' index=2'));
			}
			if (loggingEnable == true) console.log('Flushing DNS cache.');
			// flush DNS cache
			_getExecutionOutput('ipconfig /flushdns');
			break;
		default:
			if (loggingEnable == true) console.log("Error: Unsupported platform. ");
	}
}

exports.restoreDNSservers = function({DNSbackupName, loggingEnable}) {
	// restore DNS from backup per platform
	if (DNSbackupName === undefined) var DNSbackupName="before-dns-changer";
	switch(os.platform()) {
		case 'linux':
			if (loggingEnable == true) console.log('Changing permissions');
			// make mutable
			_execute('chattr -i /etc/resolv.conf');
			if (loggingEnable == true) console.log('Moving resolv.conf')
			// check if resolv.conf exists
			if (shell.test('-f', String('/etc/resolv.conf.'+DNSbackupName))) {
				if (loggingEnable == true) console.log('Found backed up resolv file.');
			}
			else {
				if (loggingEnable == true) throw 'Could not find backed up resolv file.';
			}
			// move backup to resolv.conf
			shell.mv(String('/etc/resolv.conf.'+DNSbackupName), '/etc/resolv.conf');
			if (loggingEnable == true) console.log('Renamed file.');
			if (loggingEnable == true) console.log('Flushing resolve cache');
			// flush DNS cache
			_getExecutionOutput('which systemd-resolve && systemd-resolve --flush-caches');
			_getExecutionOutput('which nscd && service nscd reload && service nscd restart');
			break;
		case 'darwin':
			// check if backup file exists
			var DNSservers;
			if (shell.test('-f', String('/Library/Caches/'+DNSbackupName+'.txt'))) {
				if (loggingEnable == true) console.log('Found backed up DNS file.');
				DNSservers = shell.cat(String('/Library/Caches/'+DNSbackupName+'.txt')).stdout;
			}
			else {
				if (loggingEnable == true) throw console.log('Could not find backed up DNS file.');
			}
			// get network interfaces
			var interfaces = _getExecutionOutput('networksetup -listallnetworkservices | sed 1,1d');
			interfaces = interfaces.split('\n');
			if (loggingEnable == true) console.log('Restoring DNS servers');
			for (x in interfaces) {
				// restore backed up server addresses per interface
				switch(x) {
					default:
						if (loggingEnable == true) console.log("INTERFACE:", interfaces[x]);
						if (loggingEnable == true) console.log(String('networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers))
						_getExecutionOutput(String('networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers));
				}
			}
			// remove backup
			shell.rm(String('/Library/Caches/'+DNSbackupName+'.txt'));
			break;
		case 'win32':
			// get interfaces
			var interfaces_ethernet = String(_getExecutionOutput('ipconfig | find /i "Ethernet adapter"').trim().split(' ').slice(2)).replace(':','').split(' ');
			var interfaces_wireless = String(_getExecutionOutput('ipconfig | find /i "Wireless LAN adapter"').trim().split(' ').slice(3)).replace(':','').split(' ');
			if (loggingEnable == true) console.log('ETHERNET  :', interfaces_ethernet);
			if (loggingEnable == true) console.log('WIRELESS :', interfaces_wireless);
			if (/^[0-9a-zA-Z]+$/.test(interfaces_ethernet)) for (x in interfaces_ethernet) {
				// restore backed up DNS addresses per ethernet interface
				if (loggingEnable == true) console.log('Setting ethernet interface:', interfaces_ethernet[x]);
				_execute(String('netsh interface ipv4 set dns name="'+interfaces_ethernet[x]+'" dhcp'));
			}
			if (/^[0-9a-zA-Z]+$/.test(interfaces_wireless)) for (x in interfaces_wireless) {
				// restore backed up DNS addresses per wireless interface
				if (loggingEnable == true) console.log('Setting wireless interface:', interfaces_wireless[x]);
				_execute(String('netsh interface ipv4 set dns name="'+interfaces_wireless[x]+'" dhcp'));
			}
			if (loggingEnable == true) console.log('Flushing DNS cache.');
			// flush DNS cache
			_getExecutionOutput('ipconfig /flushdns');
			break;
		default:
			if (loggingEnable == true) console.log('Error: Unsupported platform.')
	}
}
