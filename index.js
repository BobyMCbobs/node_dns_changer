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

const exec = require('child_process').exec,
 os = require('os'),
 fs = require('fs'),
 shell = require('shelljs'),
 cmd = require('node-cmd'),
 network = require('network');
shell.config.silent = true;

var macOSignoreInterfaces = ['iPhone USB', 'Bluetooth PAN', 'Thunderbolt Bridge', 'lo0', ''];

function _execute({command, loggingEnable}){
	require('child_process').exec(command);
};

function _getExecutionOutput(command) {
	// return output of a command
	var usercmd;
	cmd.get(command, function(err, data, stderr) {
		usercmd = data;
	})
	return usercmd;
}

exports.setDNSservers = function({DNSservers, DNSbackupName, loggingEnable}) {
	// set a DNS per platform
	if (loggingEnable == true) console.log("node_dns_changer::> ",'Setting DNS servers:', DNSservers);
	if (DNSservers === undefined) throw "You must include two DNS server addresses";
	if (DNSbackupName === undefined) var DNSbackupName="before-dns-changer";
	switch(os.platform()) {
		case 'linux':
			// move resolv.conf to another location
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Backing up resolv.conf');
			fs.rename('/etc/resolv.conf', String('/etc/resolv.conf.'+DNSbackupName), (err) => {
				if (err) throw err;
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Renamed file.');
			});
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Writing resolv.conf');
			// write new DNS server config
			fs.writeFile('/etc/resolv.conf', String("nameserver "+DNSservers[0]+'\n'+"nameserver "+DNSservers[1]+'\n'), function (err) {
				if (err) throw err;
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Saved file.');
			});
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Changing permissions');
			// make resolv.conf immutable
			_execute('chattr +i /etc/resolv.conf');
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Flushing DNS cache (if systemd-resolve is available).');
			// flush DNS cache
			_getExecutionOutput('which systemd-resolve && systemd-resolve --flush-caches');
			_getExecutionOutput('which nscd && service nscd reload && service nscd restart');
			break;
		case 'darwin':
			// get interfaces
			var interfaces = [];
			cmd.get('networksetup -listallnetworkservices | sed 1,1d', function(err, data, stderr) {
				var interfaces = data;
				interfaces = interfaces.split('\n');
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Backing up current DNS servers');
				// back up current DNS server addresses
				_getExecutionOutput("scutil --dns | grep 'nameserver\[[0-9]*\]' | head -n 1 | tail -n 1 | cut -d ':' -f2 > /Library/Caches/"+DNSbackupName+".txt");
				_getExecutionOutput("scutil --dns | grep 'nameserver\[[0-9]*\]' | head -n 2 | tail -n 1 | cut -d ':' -f2 >> /Library/Caches/"+DNSbackupName+".txt");
				for (x in interfaces) {
					// set DNS servers, per interface
					if (!(macOSignoreInterfaces.indexOf(interfaces[x]) > -1)) {
						if (loggingEnable == true) console.log("node_dns_changer::> ","Setting interface:", interfaces[x]);
						if (loggingEnable == true) console.log(String("node_dns_changer::> "+'networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers.join(' ')))
						_getExecutionOutput(String('networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers.join(' ')));
					}
					else {
						if (loggingEnable == true) console.log(String("Ignoring interface: '" + interfaces[x] + "'"));
					}
				}
			});
			break;
		case 'win32':
			// get interfaces
			var interfaces;
			network.get_interfaces_list(function(err, obj) {
				interfaces = obj;
				if (loggingEnable == true) console.log("node_dns_changer::> ",'INTERFACES: ', interfaces)
				for (x in interfaces) {
					// set DNS servers per ethernet interface
					if (loggingEnable == true) console.log("node_dns_changer::> ",'Setting ethernet interface:', interfaces[x].name);
					_getExecutionOutput(String('netsh interface ipv4 set dns name="'+interfaces[x].name+'" static ' + DNSservers[0] + ' primary'));
					_getExecutionOutput(String('netsh interface ipv4 add dns name="'+interfaces[x].name+'" ' + DNSservers[1] + ' index=2'));
				}
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Flushing DNS cache.');
				// flush DNS cache
				_getExecutionOutput('ipconfig /flushdns');
			});
			break;
		default:
			if (loggingEnable == true) console.log("node_dns_changer::> ","Error: Unsupported platform. ");
	}
}

exports.restoreDNSservers = function({DNSbackupName, loggingEnable}) {
	// restore DNS from backup per platform
	if (DNSbackupName === undefined) var DNSbackupName="before-dns-changer";
	switch(os.platform()) {
		case 'linux':
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Changing permissions');
			// make mutable
			_execute('chattr -i /etc/resolv.conf');
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Moving resolv.conf')
			// check if resolv.conf exists
			if (shell.test('-f', String('/etc/resolv.conf.'+DNSbackupName))) {
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Found backed up resolv file.');
			}
			else {
				if (loggingEnable == true) throw 'Could not find backed up resolv file.';
			}
			// move backup to resolv.conf
			shell.mv(String('/etc/resolv.conf.'+DNSbackupName), '/etc/resolv.conf');
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Renamed file.');
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Flushing resolve cache');
			// flush DNS cache
			_getExecutionOutput('which systemd-resolve && systemd-resolve --flush-caches');
			_getExecutionOutput('which nscd && service nscd reload && service nscd restart');
			break;
		case 'darwin':
			// check if backup file exists
			var interfaces = [];
			var DNSservers;
			if (shell.test('-f', String('/Library/Caches/'+DNSbackupName+'.txt'))) {
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Found backed up DNS file.');
				DNSservers = shell.cat(String('/Library/Caches/'+DNSbackupName+'.txt')).stdout;
				DNSservers = DNSservers.split('\n');
				DNSservers = DNSservers.join(' ');
			}
			else {
				if (loggingEnable == true) throw console.log("node_dns_changer::> ",'Could not find backed up DNS file.');
			}
			// get network interfaces
			cmd.get('networksetup -listallnetworkservices | sed 1,1d', function(err, data, stderr) {
				var interfaces = data;
				interfaces = interfaces.split('\n');
				if ('\n' in interfaces) interfaces = interfaces.split('\n');
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Restoring DNS servers');
				for (x in interfaces) {
					// restore backed up server addresses per interface
					if (!(macOSignoreInterfaces.indexOf(interfaces[x]) > -1)) {
							if (loggingEnable == true) console.log("node_dns_changer::> ","INTERFACE:", interfaces[x]);
							if (loggingEnable == true) console.log(String("node_dns_changer::> "+'networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers))
							_getExecutionOutput(String('networksetup -setdnsservers "'+interfaces[x]+'" ' + DNSservers));
					}
					else {
						if (loggingEnable == true) console.log(String("Ignoring interface: '" + interfaces[x] + "'"));
					}
				}
				// remove backup
				shell.rm(String('/Library/Caches/'+DNSbackupName+'.txt'));
			});
			break;
		case 'win32':
			// get interfaces
			var interfaces;
			network.get_interfaces_list(function(err, obj) {
				interfaces = obj;
				if (loggingEnable == true) console.log("node_dns_changer::> ",'INTERFACES: ', interfaces)
				for (x in interfaces) {
					// set DNS servers per ethernet interface
					if (loggingEnable == true) console.log('Setting ethernet interface:', interfaces[x].name);
				_getExecutionOutput(String('netsh interface ipv4 set dns name="'+interfaces[x].name+'" dhcp'));
				}
				if (loggingEnable == true) console.log("node_dns_changer::> ",'Flushing DNS cache.');
				// flush DNS cache
				_getExecutionOutput('ipconfig /flushdns');
			});
			break;
		default:
			if (loggingEnable == true) console.log("node_dns_changer::> ",'Error: Unsupported platform.')
	}
}
