// node_dns_changer

//
// Copyright (C) 2018 Caleb Woodbine <calebwoodbine.public@gmail.com>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

const exec = require('child_process').execSync,
  os = require('os'),
  fs = require('fs'),
  shell = require('shelljs'),
  cmd = require('node-cmd'),
  network = require('network'),
  version = require('./package.json').version;
shell.config.silent = true;

var macOSignoreInterfaces = ['iPhone USB', 'Bluetooth PAN', 'Thunderbolt Bridge', 'lo0', ''],
  logging = false;

async function _getExecutionOutput(command) {
	// return output of a command
  let promise = new Promise((resolve, reject) => {
    var usercmd;
    cmd.get(command, function(err, data, stderr) {
	    usercmd = data;
	    _logging(`command output: ${usercmd}`)
	    resolve(true);
    });
	});
  let result = await promise;
  return result;
}

function _determinePowershellOrNetsh() {
  // if version is Windows 7 or below use netsh
  var releaseVer = os.release().split('.');
  if (parseInt(releaseVer[0]) <= 6 && parseInt(releaseVer[1]) <= 1 || (parseInt(releaseVer[0]) == 5)) {
    // use netsh
    _logging('Using netsh for DNS configuration');
    return true;
  }
  // use powershell
    _logging('Using powershell for DNS configuration');
  return false;
}

function _logging(text) {
  if (logging == true) console.log(`[node_dns_changer]: ${text}`);
}

function _handleServerAddresses(DNSservers) {
  // if input is a string, convert it to an array of strings
  if (typeof DNSservers === 'string') {
    if ((" " in DNSservers)) return DNSservers.split(' ');
    else {
      throw "[node_dns_changer:validation]: A space must be in DNSservers if it's a string";
      return;
    }
  }
  else if (typeof DNSservers === 'object') return DNSservers;
}

function _checkVars({DNSservers, DNSbackupName, loggingEnable, mkBackup, macOSuseDHCP}) {
  if (typeof DNSservers !== 'object' && typeof DNSservers !== 'undefined') {
    throw "[node_dns_changer:validation]: DNSservers must be an object";
    return false;
  }

  if (typeof DNSservers === 'object') DNSservers.map((i) => {
    if (typeof i !== 'string' || !((/^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(i) === true) || /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/.test(i) === true)) {
      throw "[node_dns_changer:validation]: DNSservers[*] each must be strings and valid IPv4 addresses";
      return false;
    }
  });

  if (typeof DNSbackupName !== 'string') {
    throw "[node_dns_changer:validation]: DNSbackupName must be a string";
    return false;
  }

  if (typeof macOSuseDHCP !== 'boolean' && typeof macOSuseDHCP !== 'undefined') {
    throw "[node_dns_changer:validation]: macOSuseDHCP must be a boolean";
    return false;
  }

  if (typeof loggingEnable !== 'boolean') {
    throw "[node_dns_changer:validation]: loggingEnable must be a boolean";
    return false;
  }

  if (typeof mkBackup !== 'boolean' && typeof mkBackup !== 'undefined') {
    throw "[node_dns_changer:validation]: mkBackup must be a boolean";
    return false;
  }

  if (typeof rmBackup !== 'boolean' && typeof rmBackup !== 'undefined') {
    throw "[node_dns_changer:validation]: rmBackup must be a boolean";
    return false;
  }
}

exports.setDNSservers = async function({DNSservers, DNSbackupName = "before-dns-changer", loggingEnable = false, mkBackup = true}) {
	// set a DNS per platform
	if (_checkVars({DNSservers, DNSbackupName, loggingEnable, mkBackup}) === false) {
	  return;
	}
	DNSservers = _handleServerAddresses(DNSservers);
  let promise = new Promise((resolve, reject) => {
	  logging = loggingEnable;
	  _logging(`Setting DNS servers: '${DNSservers}'`);
	  if (DNSservers === undefined) throw "You must include two DNS server addresses";
	  switch(os.platform()) {
		  case 'linux':
		    if (os.userInfo().uid != 0) {
		      throw "ERROR: User must be root to change DNS settings";
		      resolve(false);
		      return;
		    }
		    if (mkBackup == true) {
			    // move resolv.conf to another location
			    _logging("Backing up resolv.conf");
			    shell.cp('-f','/etc/resolv.conf', `/etc/resolv.conf.${DNSbackupName}`);
			    resolve(false);
			  }
			  _logging("Writing resolv.conf");
			  // write new DNS server config
			  fs.writeFile('/etc/resolv.conf', `#GENERATED BY node_dns_changer, backed up to '/etc/resolv.conf.${DNSbackupName}'\nnameserver ${DNSservers[0]}\nnameserver ${DNSservers[1]}\n`, function (err) {
				  if (err) throw err;
				  _logging("Backed up DNS.");
				  resolve(false);
			  });
			  _logging("Changing permissions");
			  // make resolv.conf immutable
			  shell.exec('chattr +i /etc/resolv.conf');
			  _logging("Flushing DNS cache (if systemd-resolve is available).");
			  // flush DNS cache
			  shell.exec('which systemd-resolve 2> /dev/null && systemd-resolve --flush-caches');
			  shell.exec('systemctl is-active --quiet nscd && service nscd reload && service nscd restart');
			  resolve(true);
			  break;

		  case 'darwin':
			  // get interfaces
			  var interfaces = [];
			  cmd.get('networksetup -listallnetworkservices | sed 1,1d', function(err, data, stderr) {
				  var interfaces = data;
				  interfaces = interfaces.split('\n');
				  if (mkBackup == true) {
				    _logging("Backing up current DNS servers");
				    // back up current DNS server addresses
				    _getExecutionOutput(`scutil --dns | grep 'nameserver\[[0-9]*\]' | head -n 1 | tail -n 1 | cut -d ':' -f2 > /Library/Caches/${DNSbackupName}.txt`);
				    _getExecutionOutput(`scutil --dns | grep 'nameserver\[[0-9]*\]' | head -n 2 | tail -n 1 | cut -d ':' -f2 >> /Library/Caches/${DNSbackupName}.txt`);
				  }
				  for (x in interfaces) {
					  // set DNS servers, per interface
					  if (!(macOSignoreInterfaces.indexOf(interfaces[x]) > -1)) {
						  _logging(`Setting interface '${interfaces[x]}' using: networksetup -setdnsservers ${interfaces[x]} ${DNSservers.join(' ')}`);
						  _getExecutionOutput(`networksetup -setdnsservers ${interfaces[x]} ${DNSservers.join(' ')}`);
					  }
					  else {
						  _logging(`Ignoring interface: ${interfaces[x]}`);
					  }
				  }
				  resolve(true);
			  });
			  break;

		  case 'win32':
		    // check if user is admin
			  require('is-admin')().then(admin => {
			    if (admin == false) {
			      throw "Administator privilege are required to change DNS settings";
			      return;
			    }
			  });
			  // get interfaces
			  var interfaces;
			  network.get_interfaces_list(function(err, obj) {
				  interfaces = obj;
				  _logging(`INTERFACES: ${JSON.stringify(interfaces)}`);
				  for (x in interfaces) {
					  // set DNS servers per ethernet interface
					  _logging(`Setting ethernet interface: ${interfaces[x].name}`);
					  switch(_determinePowershellOrNetsh()) {
					    case true:
					      _logging(`Setting interface '${interfaces[x].name}' using: netsh interface ipv4 set dns name="${interfaces[x].name}" static "${DNSservers[0]}" primary`);
                _getExecutionOutput(`netsh interface ipv4 set dns name="${interfaces[x].name}" static "${DNSservers[0]}" primary`);
					      _logging(`Setting interface '${interfaces[x].name}' using: netsh interface ipv4 add dns name="${interfaces[x].name}" "${DNSservers[1]}" index=2`);
					      _getExecutionOutput(`netsh interface ipv4 add dns name="${interfaces[x].name}" "${DNSservers[1]}" index=2`);
					      break;

					    default:
						    _logging(`Setting interface '${interfaces[x]}' using: powershell Set-DnsClientServerAddress -InterfaceAlias '${interfaces[x].name}' -ServerAddresses '${DNSservers[0]},${DNSservers[1]}'`);
					      _getExecutionOutput(`powershell Set-DnsClientServerAddress -InterfaceAlias '${interfaces[x].name}' -ServerAddresses '${DNSservers[0]},${DNSservers[1]}'`);
					      break;
					  }
				  }
				  _logging("Flushing DNS cache.");
				  // flush DNS cache
				  _getExecutionOutput('ipconfig /flushdns');
				  resolve(true);
			  });
			  break;

		  default:
			  _logging("Error: Unsupported platform. ");
			  resolve(false);
	  }
	});
  let result = await promise;
  return result;
}

exports.restoreDNSservers = async function({DNSbackupName = "before-dns-changer", loggingEnable = false, rmBackup = false, macOSuseDHCP = true}) {
	// restore DNS from backup per platform
	if (_checkVars({DNSbackupName, loggingEnable, rmBackup, macOSuseDHCP}) === false) {
	  return;
	}
  let promise = new Promise((resolve, reject) => {
	  logging = loggingEnable;
	  switch(os.platform()) {
		  case 'linux':
		    if (os.userInfo().uid != 0) throw "ERROR: User must be root to change DNS settings";
			  _logging("Changing permissions");
			  // make mutable
			  if (shell.exec('chattr -i /etc/resolv.conf').code !== 0) {
          _logging("Could not make '/etc/resolv.conf' mutable");
          resolve(false);
          return;
			  }
			  _logging("Moving resolv.conf");
			  // check if resolv.conf exists
			  if (shell.test('-f', `/etc/resolv.conf.${DNSbackupName}`) !== true) {
			    _logging(`Could not find backed up settings '/etc/resolv.conf.${DNSbackupName}'.`);
			    resolve(false);
			    return;
			  }

			  _logging("Found backed up resolv file.");

		    // copy backup to resolv.conf
		    _logging("Restoring backup.");
		    if (shell.rm('-f', '/etc/resolv.conf').code !== 0) {
		      _logging("Failed to remove current '/etc/resolv.conf'");
		      resolve(false);
		      return;
		    };

		    if (shell.cp('-f',`/etc/resolv.conf.${DNSbackupName}`, '/etc/resolv.conf').code !== 0) {
		      _logging("Failed to restore backup.");
		      resolve(false);
		      return;
		    }

		    if (rmBackup == true) {
		      _logging(`Removing backup '/etc/resolv.conf.${DNSbackupName}'.`);
          shell.rm(`/etc/resolv.conf.${DNSbackupName}`);
		    }

			  // flush DNS cache
			  _logging("Flushing resolve cache");
			  shell.exec('which systemd-resolve 2> /dev/null && systemd-resolve --flush-caches');
			  shell.exec('systemctl is-active --quiet nscd && service nscd reload && service nscd restart');
			  resolve(true);
			  break;

		  case 'darwin':
			  // check if backup file exists
			  var interfaces = [];
			  var DNSservers;
			  if (macOSuseDHCP === false) {
			    if (shell.test('-f', `/Library/Caches/${DNSbackupName}.txt`)) {
				    _logging("Found backed up DNS file.");
				    DNSservers = shell.cat(`/Library/Caches/${DNSbackupName}.txt`).stdout;
				    DNSservers = DNSservers.split('\n');
				    DNSservers = DNSservers.join(' ');
				  }
			    else {
				    if (logging == true) throw "Could not find backed up DNS file.";
			    }
		    }
			  else if (macOSuseDHCP === true) DNSservers = "\"Empty\"";
			  // get network interfaces
			  cmd.get('networksetup -listallnetworkservices | sed 1,1d', function(err, data, stderr) {
				  var interfaces = data;
				  interfaces = interfaces.split('\n');
				  if ('\n' in interfaces) interfaces = interfaces.split('\n');
				  _logging("Restoring DNS servers");
				  for (x in interfaces) {
					  // restore backed up server addresses per interface
					  if (!(macOSignoreInterfaces.indexOf(interfaces[x]) > -1)) {
              _logging(`Setting interface '${interfaces[x]}' using: networksetup -setdnsservers ${interfaces[x]} ${DNSservers}`);
				      _getExecutionOutput(`networksetup -setdnsservers ${interfaces[x]} ${DNSservers}`);
					  }
					  else {
						  _logging(`Ignoring interface: ${interfaces[x]}`);
					  }
				  }
				  // remove backup
				  if (rmBackup == true) shell.rm(`/Library/Caches/${DNSbackupName}.txt`);
				  resolve(true);
			  });
			  break;

		  case 'win32':
	    // check if user is admin
      require('is-admin')().then(admin => {
			    if (admin == false) {
			      throw "Administator privilege are required to change DNS settings";
			      return;
			    }
			  });
			  // get interfaces
			  var interfaces;
			  network.get_interfaces_list(function(err, obj) {
				  interfaces = obj;
				  _logging(`INTERFACES: ${JSON.stringify(interfaces)}`)
				  for (x in interfaces) {
					  // set DNS servers per ethernet interface
					  _logging(`Setting ethernet interface: ${interfaces[x].name}`);
				    switch(_determinePowershellOrNetsh()) {
					    case true:
							  _logging(`Setting interface '${interfaces[x].name}' using: netsh interface ipv4 set dns name="${interfaces[x].name}" dhcp`);
                _getExecutionOutput(`netsh interface ipv4 set dns name="${interfaces[x].name}" dhcp`);
					      break;

					    default:
							  _logging(`Setting interface '${interfaces[x].name}' using: powershell Set-DnsClientServerAddress -InterfaceAlias "${interfaces[x].name}" -ResetServerAddresses`);
					      _getExecutionOutput(`powershell Set-DnsClientServerAddress -InterfaceAlias "${interfaces[x].name}" -ResetServerAddresses`);
					      break;
					  }
				  }
				  _logging("Flushing DNS cache.");
				  // flush DNS cache
				  _getExecutionOutput('ipconfig /flushdns');
			  });
			  resolve(true);
			  break;

		  default:
			  _logging("Error: Unsupported platform.");
			  resolve(false);
	  }
	});
  let result = await promise;
  return result;
}

exports.version = version;
