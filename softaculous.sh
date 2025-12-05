#!/bin/bash

clear
if [ "$*" == '--nohttps' ];  then
	FILEREPO=http://files.softaculous.com
else
	FILEREPO=https://files.softaculous.com
fi


#----------------------------------
# Detecting the Architecture
#----------------------------------
if ([ `uname -i` == x86_64 ] || [ `uname -m` == x86_64 ]); then
	ARCH=64
else
	ARCH=32
fi

# To fix the ca-certificates lets encrypt issue
if [ -f /etc/redhat-release ] ; then
	yum -y update ca-certificates
fi

echo "-----------------------------------------------"
echo " Welcome to Softaculous Apps Installer"
echo "-----------------------------------------------"
echo " "

#----------------------------
# Download the PHP Installer
#----------------------------

if [ -d /usr/local/cpanel/whostmgr ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/local/cpanel/3rdparty/bin/php install.inc $@

elif [ -d /usr/local/directadmin ] ; then
	
	mkdir /usr/local/directadmin/plugins >> /dev/null 2>&1
	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	
	if [[ -f "/usr/local/php83/bin/php" ]]  && [[ $(/usr/local/php83/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php83/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php82/bin/php" ]]  && [[ $(/usr/local/php82/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php82/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php81/bin/php" ]]  && [[ $(/usr/local/php81/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php81/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php74/bin/php" ]]  && [[ $(/usr/local/php74/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php74/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php73/bin/php" ]]  && [[ $(/usr/local/php73/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php73/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php72/bin/php" ]]  && [[ $(/usr/local/php72/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php72/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php71/bin/php" ]]  && [[ $(/usr/local/php71/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php71/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php70/bin/php" ]]  && [[ $(/usr/local/php70/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php70/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php56/bin/php" ]]  && [[ $(/usr/local/php56/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php56/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php55/bin/php" ]]  && [[ $(/usr/local/php55/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php55/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/usr/local/php54/bin/php" ]]  && [[ $(/usr/local/php54/bin/php -v | grep -i ionCube) ]]; then
		/usr/local/php54/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [ -f "/usr/local/bin/php" ] ; then
		/usr/local/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [ -f "/usr/bin/php" ] ; then
		/usr/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	fi
	
elif [ -d /usr/local/psa ] ; then
	
	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	
	if [[ -f "/opt/plesk/php/8.3/bin/php" ]]  && [[ $(/opt/plesk/php/8.3/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/8.3/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/8.2/bin/php" ]]  && [[ $(/opt/plesk/php/8.2/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/8.2/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/8.1/bin/php" ]]  && [[ $(/opt/plesk/php/8.1/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/8.1/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/7.4/bin/php" ]]  && [[ $(/opt/plesk/php/7.4/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/7.4/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/7.3/bin/php" ]]  && [[ $(/opt/plesk/php/7.3/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/7.3/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/7.2/bin/php" ]]  && [[ $(/opt/plesk/php/7.2/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/7.2/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/7.1/bin/php" ]]  && [[ $(/opt/plesk/php/7.1/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/7.1/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/7.0/bin/php" ]]  && [[ $(/opt/plesk/php/7.0/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/7.0/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/5.6/bin/php" ]]  && [[ $(/opt/plesk/php/5.6/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/5.6/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/5.5/bin/php" ]]  && [[ $(/opt/plesk/php/5.5/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/5.5/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [[ -f "/opt/plesk/php/5.4/bin/php" ]]  && [[ $(/opt/plesk/php/5.4/bin/php -v | grep -i ionCube) ]]; then
		/opt/plesk/php/5.4/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	elif [ -f "/usr/bin/php" ] ; then
		/usr/bin/php -d open_basedir="" -d safe_mode=0 -d disable_functions="" install.inc $@
	fi
	
elif [ -d /hsphere ] ; then
	
	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/hsphere/shared/php5/bin/php-cli -d open_basedir="" -d safe_mode=0 install.inc $@

elif [ -d /home/interworx ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/home/interworx/bin/php install.inc $@

elif [ -d /usr/local/mgr5 ]; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	
	if [[ -f "/opt/php82/bin/php" ]]  && [[ $(/opt/php82/bin/php -v | grep -i ionCube) ]]; then
		/opt/php82/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php81/bin/php" ]]  && [[ $(/opt/php81/bin/php -v | grep -i ionCube) ]]; then
		/opt/php81/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php74/bin/php" ]]  && [[ $(/opt/php74/bin/php -v | grep -i ionCube) ]]; then
		/opt/php74/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php73/bin/php" ]]  && [[ $(/opt/php73/bin/php -v | grep -i ionCube) ]]; then
		/opt/php73/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php72/bin/php" ]]  && [[ $(/opt/php72/bin/php -v | grep -i ionCube) ]]; then
		/opt/php72/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php71/bin/php" ]]  && [[ $(/opt/php71/bin/php -v | grep -i ionCube) ]]; then
		/opt/php71/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php70/bin/php" ]]  && [[ $(/opt/php70/bin/php -v | grep -i ionCube) ]]; then
		/opt/php70/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php56/bin/php" ]]  && [[ $(/opt/php56/bin/php -v | grep -i ionCube) ]]; then
		/opt/php56/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php55/bin/php" ]]  && [[ $(/opt/php55/bin/php -v | grep -i ionCube) ]]; then
		/opt/php55/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [[ -f "/opt/php54/bin/php" ]]  && [[ $(/opt/php54/bin/php -v | grep -i ionCube) ]]; then
		/opt/php54/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	elif [ -f "/usr/bin/php" ] ; then
		/usr/bin/php -d disable_functions="" -d auto_prepend_file=none -d auto_append_file=none install.inc $@
	fi
	
elif [ -d /usr/local/ispmgr ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@

elif [ -d /usr/local/ispconfig ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@

elif [ -d /usr/local/cwp ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/local/cwp/php/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@
	
elif [ -d /usr/local/webuzo ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/local/emps/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@
	
elif [ -d /usr/local/vesta ] ; then

	wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
	/usr/local/vesta/php/bin/php -d open_basedir="" -d safe_mode=0 install.inc $@
	
fi

phpret=$?
# Was there an error
if [ $phpret != "0" ]; then
 	exit $phpret;
fi

for opt in "$@" 
	do
	case $opt in
	"--remote")
		LOG=/var/log/softaculous_remote.log
		
		# Stop all the services of EMPS if they were there.
		/usr/local/emps/bin/mysqlctl stop >> $LOG 2>&1
		/usr/local/emps/bin/nginxctl stop >> $LOG 2>&1
		/usr/local/emps/bin/fpmctl stop >> $LOG 2>&1

		# Remove the EMPS package
		rm -rf /usr/local/emps/ >> $LOG 2>&1

		# The necessary folders
		mkdir /usr/local/emps >> $LOG 2>&1
		mkdir /usr/local/softaculous >> $LOG 2>&1

		echo "Installing EMPS..." >> $LOG 2>&1
		wget -N -O /usr/local/softaculous/EMPS.tar.gz "$FILEREPO/emps.php?latest=1&arch=$ARCH" >> $LOG 2>&1

		# Extract EMPS
		tar -xvzf /usr/local/softaculous/EMPS.tar.gz -C /usr/local/emps >> $LOG 2>&1
		rm -rf /usr/local/softaculous/EMPS.tar.gz >> $LOG 2>&1

		wget -O install.inc $FILEREPO/install.inc >> /dev/null 2>&1
		/usr/local/emps/bin/php -d open_basedir="" -d zend_extension=/usr/local/emps/lib/php/ioncube_loader_lin_5.3.so install.inc $*
		;;
	"--enterprise")
		NOEMPS=0
		if [ -n "$2" ] && [ $2 == '--noemps' ] ; then
			NOEMPS=1
		fi
		
		LOG=/var/log/softaculous_enterprise.log
		
		# Stop all the services of EMPS if they were there.
		/usr/local/emps/bin/mysqlctl stop >> $LOG 2>&1
		/usr/local/emps/bin/nginxctl stop >> $LOG 2>&1
		/usr/local/emps/bin/fpmctl stop >> $LOG 2>&1

		# Remove the EMPS package
		rm -rf /usr/local/emps/ >> $LOG 2>&1
		
		# Softaculous Directory
		mkdir /usr/local/softaculous >> $LOG 2>&1

		# Install EMPS
		if [ $NOEMPS != '1' ] ; then
			# EMPS Directory
			mkdir /usr/local/emps >> $LOG 2>&1
			
			echo "Installing EMPS..."
			wget -N -O /usr/local/softaculous/EMPS.tar.gz "$FILEREPO/emps.php?latest=1&arch=$ARCH" >> $LOG 2>&1
		
			# Extract EMPS
			tar -xvzf /usr/local/softaculous/EMPS.tar.gz -C /usr/local/emps >> $LOG 2>&1
			rm -rf /usr/local/softaculous/EMPS.tar.gz >> $LOG 2>&1
			
			PHPBIN=/usr/local/emps/bin/php
			OPT_IONCUBE="-d zend_extension=/usr/local/emps/lib/php/ioncube_loader_lin_5.3.so"
		else
			PHPBIN=php
			OPT_IONCUBE=""
			PHP_VER=`$PHPBIN -n -r "echo PHP_VERSION;"`
			if [ $? != 0 ]; then
				echo "PHP Version : Not Found"
				exit 1;
			else
				echo "PHP Version : $PHP_VER"
			fi
			php -m | grep ionCube > /dev/null 2>&1
			if [ $? != 0 ]; then
				echo "ionCube Loader : Not Found"
				exit 1;
			else
				echo "ionCube Loader : OK"
			fi
		fi
		
		wget -O install.inc $FILEREPO/install.inc >> $LOG 2>&1
		$PHPBIN -d open_basedir="" $OPT_IONCUBE install.inc $*
		if [ $? != 0 ] ; then
			echo "Setup was not successful"
		fi
		;;
	esac
done

