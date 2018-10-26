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

const exec = require('child_process').exec,
 os = require('os'),
 fs = require('fs'),
 shell = require('shelljs'),
 cmd = require('node-cmd'),
 network = require('network');
shell.config.silent = true;

var macOSignoreInterfaces = ['iPhone USB', 'Bluetooth PAN', 'Thunderbolt Bridge', 'lo0', ''],
  logging = false;

async function _getExecutionOutput(command) {
	// return output of a command
  let promise = new Promise((resolve, reject) => {
    var usercmd;
    cmd.get(command, function(err, data, stderr) {
	    usercmd = data;
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
    return true;
  }
  // use powershell
  return false;
}

function _logging(text) {
  if (logging == true) console.log(text);
}

function _handleServerAddresses(DNSservers) {
  // if input is a string, convert it to an array of strings
  if (typeof DNSservers === 'string') {
    if ((" " in DNSservers)) return DNSservers.split(' ');
    else {
      throw "A space must be in DNSservers if it's a string"; return;
    }
  }
  else if (typeof DNSservers === 'object') return DNSservers;
}

function _checkVars({DNSservers, DNSbackupName, loggingEnable, mkBackup}) {
  if (typeof DNSservers !== 'object' && typeof DNSservers !== 'undefined') {
    throw "DNSservers must be an object";
    return;
  }

  if (typeof DNSservers === 'object') DNSservers.map((i) => {if (typeof i !== 'string') {
    throw "DNSservers[*] must be strings";
    return;
  }});

  if (typeof DNSbackupName !== 'string') {
    throw "DNSbackupName must be a string";
    return;
  }

  if (typeof loggingEnable !== 'boolean') {
    throw "loggingEnable must be a boolean";
    return;
  }

  if (typeof mkBackup !== 'boolean' && typeof mkBackup !== 'undefined') {
    throw "mkBackup must be a boolean";
    return;
  }

  if (typeof rmBackup !== 'boolean' && typeof rmBackup !== 'undefined') {
    throw "rmBackup must be a boolean";
    return;
  }
}

exports.setDNSservers = async function({DNSservers, DNSbackupName = "before-dns-changer", loggingEnable = false, mkBackup = true}) {
	// set a DNS per platform
	DNSservers = _handleServerAddresses(DNSservers);
	_checkVars({DNSservers, DNSbackupName, loggingEnable, mkBackup});
  let promise = new Promise((resolve, reject) => {
	  logging = loggingEnable;
	  _logging(`node_dns_changer::> Setting DNS servers: ${DNSservers}`);
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
			    _logging("node_dns_changer::> Backing up resolv.conf");
			    shell.cp('-f','/etc/resolv.conf', `/etc/resolv.conf.${DNSbackupName}`);
			    resolve(false);
			  }
			  _logging("node_dns_changer::> Writing resolv.conf");
			  // write new DNS server config
			  fs.writeFile('/etc/resolv.conf', `#GENERATED BY node_dns_changer\nnameserver ${DNSservers[0]}\nnameserver ${DNSservers[1]}\n`, function (err) {
				  if (err) throw err;
				  _logging("node_dns_changer::> Backed up DNS.");
				  resolve(false);
			  });
			  _logging("node_dns_changer::> Changing permissions");
			  // make resolv.conf immutable
			  shell.exec('chattr +i /etc/resolv.conf');
			  _logging("node_dns_changer::> Flushing DNS cache (if systemd-resolve is available).");
			  // flush DNS cache
			  shell.exec('which systemd-resolve && systemd-resolve --flush-caches');
			  shell.exec('which nscd && service nscd reload && service nscd restart');
			  resolve(true);
			  break;

		  case 'darwin':
			  // get interfaces
			  var interfaces = [];
			  cmd.get('networksetup -listallnetworkservices | sed 1,1d', function(err, data, stderr) {
				  var interfaces = data;
				  interfaces = interfaces.split('\n');
				  if (mkBackup == true) {
				    _logging("node_dns_changer::> Backing up current DNS servers");
				    // back up current DNS server addresses
				    _getExecutionOutput(`scutil --dns | grep 'nameserver\[[0-9]*\]' | head -n 1 | tail -n 1 | cut -d ':' -f2 > /Library/Caches/${DNSbackupName}.txt`);
				    _getExecutionOutput(`scutil --dns | grep 'nameserver\[[0-9]*\]' | head -n 2 | tail -n 1 | cut -d ':' -f2 >> /Library/Caches/${DNSbackupName}.txt`);
				  }
				  for (x in interfaces) {
					  // set DNS servers, per interface
					  if (!(macOSignoreInterfaces.indexOf(interfaces[x]) > -1)) {
						  _logging(`node_dns_changer::> Setting interface: ${interfaces[x]}`);
						  _logging(`node_dns_changer::> networksetup -setdnsservers ${interfaces[x]} ${DNSservers.join(' ')}`);
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
				  _logging(`node_dns_changer::> INTERFACES: ${JSON.stringify(interfaces)}`);
				  for (x in interfaces) {
					  // set DNS servers per ethernet interface
					  _logging(`node_dns_changer::> Setting ethernet interface: ${interfaces[x].name}`);
					  switch(_determinePowershellOrNetsh()) {
					    case true:
                _getExecutionOutput(`netsh interface ipv4 set dns name="${interfaces[x].name}" static "${DNSservers[0]}" primary`);
					      _getExecutionOutput(`netsh interface ipv4 add dns name="${interfaces[x].name}" "${DNSservers[1]}" index=2`);
					      break;

					    default:
					      _getExecutionOutput(`powershell Set-DnsClientServerAddress -InterfaceAlias '${interfaces[x].name}' -ServerAddresses '${DNSservers[0]},${DNSservers[1]}'`);
					      break;
					  }
				  }
				  _logging("node_dns_changer::> Flushing DNS cache.");
				  // flush DNS cache
				  _getExecutionOutput('ipconfig /flushdns');
				  resolve(true);
			  });
			  break;

		  default:
			  _logging("node_dns_changer::> Error: Unsupported platform. ");
			  resolve(false);
	  }
	});
  let result = await promise;
  return result;
}

exports.restoreDNSservers = async function({DNSbackupName = "before-dns-changer", loggingEnable = false, rmBackup = false}) {
	// restore DNS from backup per platform
	_checkVars({DNSbackupName, loggingEnable, rmBackup});
  let promise = new Promise((resolve, reject) => {
	  logging = loggingEnable;
	  switch(os.platform()) {
		  case 'linux':
		    if (os.userInfo().uid != 0) throw "ERROR: User must be root to change DNS settings";
			  _logging("node_dns_changer::> Changing permissions");
			  // make mutable
			  if (shell.exec('chattr -i /etc/resolv.conf').code !== 0) {
          _logging("node_dns_changer::> Could not make '/etc/resolv.conf' mutable");
          resolve(false);
          return;
			  }
			  _logging("node_dns_changer::> Moving resolv.conf");
			  // check if resolv.conf exists
			  if (shell.test('-f', `/etc/resolv.conf.${DNSbackupName}`) !== true) {
			    _logging(`node_dns_changer::> Could not find backed up settings '/etc/resolv.conf.${DNSbackupName}'.`);
			    resolve(false);
			    return;
			  }

			  _logging("node_dns_changer::> Found backed up resolv file.");

		    // copy backup to resolv.conf
		    _logging("node_dns_changer::> Restoring backup.");
		    if (shell.rm('-f', '/etc/resolv.conf').code !== 0) {
		      _logging("node_dns_changer::> Failed to remove current '/etc/resolv.conf'");
		      resolve(false);
		      return;
		    };

		    if (shell.cp('-f',`/etc/resolv.conf.${DNSbackupName}`, '/etc/resolv.conf').code !== 0) {
		      _logging("node_dns_changer::> Failed to restore backup.");
		      resolve(false);
		      return;
		    }

		    if (rmBackup == true) {
		      _logging(`node_dns_changer::> Removing backup '/etc/resolv.conf.${DNSbackupName}'.`);
          shell.rm(`/etc/resolv.conf.${DNSbackupName}`);
		    }

			  // flush DNS cache
			  _logging("node_dns_changer::> Flushing resolve cache");
			  shell.exec('which systemd-resolve && systemd-resolve --flush-caches');
			  shell.exec('which nscd && service nscd reload && service nscd restart');
			  resolve(true);
			  break;

		  case 'darwin':
			  // check if backup file exists
			  var interfaces = [];
			  var DNSservers;
			  if (shell.test('-f', `/Library/Caches/${DNSbackupName}.txt`)) {
				  _logging("node_dns_changer::> Found backed up DNS file.");
				  DNSservers = shell.cat(`/Library/Caches/${DNSbackupName}.txt`).stdout;
				  DNSservers = DNSservers.split('\n');
				  DNSservers = DNSservers.join(' ');
			  }
			  else {
				  if (logging == true) throw "node_dns_changer::> Could not find backed up DNS file.";
			  }
			  // get network interfaces
			  cmd.get('networksetup -listallnetworkservices | sed 1,1d', function(err, data, stderr) {
				  var interfaces = data;
				  interfaces = interfaces.split('\n');
				  if ('\n' in interfaces) interfaces = interfaces.split('\n');
				  _logging("node_dns_changer::> Restoring DNS servers");
				  for (x in interfaces) {
					  // restore backed up server addresses per interface
					  if (!(macOSignoreInterfaces.indexOf(interfaces[x]) > -1)) {
							  _logging(`node_dns_changer::> INTERFACE: ${interfaces[x]}`);
							  _logging(`node_dns_changer::> networksetup -setdnsservers ${interfaces[x]} ${DNSservers}`)
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
				  _logging(`node_dns_changer::> INTERFACES: ${JSON.stringify(interfaces)}`)
				  for (x in interfaces) {
					  // set DNS servers per ethernet interface
					  _logging(`Setting ethernet interface: ${interfaces[x].name}`);
				    switch(_determinePowershellOrNetsh()) {
					    case true:
                _getExecutionOutput(`netsh interface ipv4 set dns name="${interfaces[x].name}" dhcp`);
					      break;

					    default:
					      _getExecutionOutput(`powershell Set-DnsClientServerAddress -InterfaceAlias "${interfaces[x].name}" -ResetServerAddresses`);
					      break;
					  }
				  }
				  _logging("node_dns_changer::> Flushing DNS cache.");
				  // flush DNS cache
				  _getExecutionOutput('ipconfig /flushdns');
			  });
			  resolve(true);
			  break;

		  default:
			  _logging("node_dns_changer::> Error: Unsupported platform.");
			  resolve(false);
	  }
	});
  let result = await promise;
  return result;
}

exports.version = function() {
  return (require('./package.json').version);
}
