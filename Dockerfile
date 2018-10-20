FROM opensuse/leap
RUN zypper in -y nodejs npm8 attr
RUN mkdir -p /root/node_dns_changer
ADD . /root/node_dns_changer/
RUN cd /root/node_dns_changer && npm i