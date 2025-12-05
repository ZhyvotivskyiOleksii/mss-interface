#!/bin/bash

clear

FILEREPO=http://a.softaculous.com/backuply-server/files/

#----------------------------------
# Detecting the Architecture
#----------------------------------
if [ `uname -m` == x86_64 ]; then
	ARCH=64
else
	ARCH=32
fi

echo "-----------------------------------------------"
echo " Welcome to Backuply Installer"
echo "-----------------------------------------------"
echo " "

#----------------------------
# Download the PHP Installer
#----------------------------

if [ -d /usr/local/webuzo ] ; then
	
	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/local/emps/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@

elif [ -d /usr/local/directadmin ] ; then
	
	mkdir /usr/local/directadmin/plugins >> /dev/null 2>&1
	mkdir /usr/local/directadmin/plugins/backuply >> /dev/null 2>&1
	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	
	# Download ioncube first
	/usr/local/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc ioncube >> /dev/null 2>&1
	
	# Install Backuply
	/usr/local/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" -d zend_extension="/usr/local/directadmin/plugins/backuply/ioncube.so" install.inc $@

elif [ -d /home/interworx ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/home/interworx/bin/php install.inc $@

elif [ -d /usr/local/mgr5 ]; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@
	
elif [ -d /usr/local/ispmgr ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@
	
elif [ -d /usr/local/cpanel ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/local/cpanel/3rdparty/bin/php install.inc $@
	
fi

