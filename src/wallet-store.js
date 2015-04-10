(function() {
  var hasProp = {}.hasOwnProperty;

  this.WalletStore = (function() {
    var languageCodeToLanguage = {
      'de': 'German',
      'hi': 'Hindi',
      'no': 'Norwegian',
      'ru': 'Russian',
      'pt': 'Portuguese',
      'bg': 'Bulgarian',
      'fr': 'French',
      'zh-cn': 'Chinese Simplified',
      'hu': 'Hungarian',
      'sl': 'Slovenian',
      'id': 'Indonesian',
      'sv': 'Swedish',
      'ko': 'Korean',
      'el': 'Greek',
      'en': 'English',
      'it': 'Italiano',
      'es': 'Spanish',
      'vi': 'Vietnam',
      'th': 'Thai',
      'ja': 'Japanese',
      'pl': 'Polski',
      'da': 'Danish',
      'ro': 'Romanian',
      'nl': 'Dutch',
      'tr': 'Turkish'
    };
    var currencyCodeToCurrency = {
      'ISK': 'lcelandic Króna',
      'HKD': 'Hong Kong Dollar',
      'TWD': 'New Taiwan Dollar',
      'CHF': 'Swiss Franc',
      'EUR': 'Euro',
      'DKK': 'Danish Krone',
      'CLP': 'Chilean, Peso',
      'USD': 'U.S. Dollar',
      'CAD': 'Canadian Dollar',
      'CNY': 'Chinese Yuan',
      'THB': 'Thai Baht',
      'AUD': 'Australian Dollar',
      'SGD': 'Singapore Dollar',
      'KRW': 'South Korean Won',
      'JPY': 'Japanese Yen',
      'PLN': 'Polish Zloty',
      'GBP': 'Great British Pound',
      'SEK': 'Swedish Krona',
      'NZD': 'New Zealand Dollar',
      'BRL': 'Brazil Real',
      'RUB': 'Russian Ruble'
    };
    var demo_guid = 'abcaa314-6f67-6705-b384-5d47fbe9d7cc';
    var password; //Password
    var guid; //Wallet identifier
    var double_encryption = false; //If wallet has a second password
    var dpasswordhash; //double encryption Password
    var language = 'en';
    var mnemonicVerified = false;
    var xpubs = [];
    var transactions = [];
    var n_tx = 0;
    var addresses = {};
    var maxAddr = 1000;
    var didUpgradeToHd = null;
    var address_book = {};
    var pbkdf2_iterations = null;
    var final_balance = 0;
    var total_sent = 0;
    var total_received = 0;
    var tx_notes = {};
    var defaultAccountIdx = 0;
    var disable_logout = false;
    var mixer_fee = 0.5;
    var isAccountRecommendedFeesValid = true;
    var amountToRecommendedFee = {};
    var latest_block = null;
    var tx_tags = {};
    var tag_names = [];
    var api_code = "0";
    var haveBuildHDWallet = false;
    var auth_type; //The two factor authentication type used. 0 for none.
    var real_auth_type = 0; //The real two factor authentication. Even if there is a problem with the current one (for example error 2FA sending email).
    var encrypted_wallet_data; //Encrypted wallet data (Base64, AES 256)
    var payload_checksum; //SHA256 hash of the current wallet.aes.json
    var myHDWallet = null;
    var sharedcoin_endpoint; //The URL to the sharedcoin node
    var sharedKey; //Shared key used to prove that the wallet has succesfully been decrypted, meaning you can't overwrite a wallet backup even if you have the guid
    var didSetGuid = false;
    var isPolling = false;
    var localWalletJsonString = null;
    var legacyAddressesNumTxFetched = 0;
    var recommend_include_fee = true; //Number of unconfirmed transactions in blockchain.info's memory pool
    var default_pbkdf2_iterations = 5000;
    var isRestoringWallet = false;
    var counter = 0;
    var logout_timeout; //setTimeout return value for the automatic logout
    var sync_pubkeys = false;
    var isSynchronizedWithServer = true;
    var haveSetServerTime = false; //Whether or not we have synced with server time
    var serverTimeOffset = 0; //Difference between server and client time
    var numOldTxsToFetchAtATime = 10;
    var event_listeners = []; //Emits Did decrypt wallet event (used on claim page)

    ////////////////////////////////////////////////////////////////////////////
    // Private functions
    ////////////////////////////////////////////////////////////////////////////
    var unsafeAddLegacyAddress = function(key) {
      if ((key.addr == null) || !MyWallet.isAlphaNumericSpace(key.addr)) {
        return this.sendEvent("msg", {
          type: "error",
          message: 'Your wallet contains an invalid address. This is a sign of possible corruption, please double check all your BTC is accounted for. Backup your wallet to remove this error.'
        });
      } else {
        if (key.tag === 1 || !MyWallet.isAlphaNumericSpace(key.tag)) {
          key.tag = null;
        }
        if ((key.label != null) && !MyWallet.isAlphaNumericSpace(key.tag)) {
          key.label = null;
        }
        return addresses[key.addr] = key;
      }
    };
    ////////////////////////////////////////////////////////////////////////////
    return {
    ////////////////////////////////////////////////////////////////////////////
    // Public functions
    ////////////////////////////////////////////////////////////////////////////
      setPbkdf2Iterations: function(iterations) {
        return pbkdf2_iterations = iterations;
      },
      getPbkdf2Iterations: function() {
        return pbkdf2_iterations;
      },
      getLanguage: function() {
        if (language != null) {
          return language;
        } else {
          return MyStore.get('language');
        }
      },
      setLanguage: function(lan) {
        MyStore.put('language', lan);
        language = lan;
      },
      walletIsFull: function() {
        return Object.keys(addresses).length >= maxAddr;
      },
      getLanguages: function() {
        return languageCodeToLanguage;
      },
      getCurrencies: function() {
        return currencyCodeToCurrency;
      },
      didVerifyMnemonic: function() {
        mnemonicVerified = true;
        MyWallet.backupWalletDelayed();
      },
      setMnemonicVerified: function(bool) {
        mnemonicVerified = bool;
      },
      isMnemonicVerified: function() {
        return mnemonicVerified;
      },
      setEmptyXpubs: function() {
        xpubs = [];
      },
      pushXpub: function(xpub) {
        xpubs.push(xpub);
      },
      getXpubs: function() {
        return xpubs;
      },
      getTransactions: function() {
        return transactions;
      },
      pushTransaction: function(tx) {
        transactions.push(tx);
      },
      getAllTransactions: function() {
        return transactions.map(MyWallet.processTransaction);
      },
      didUpgradeToHd: function() {
        return didUpgradeToHd;
      },
      setDidUpgradeToHd: function(bool) {
        didUpgradeToHd = bool;
      },
      getAddressBook: function() {
        return address_book;
      },
      getAddressBookLabel: function(address) {
        return address_book[address];
      },
      deleteAddressBook: function(addr) {
        delete address_book[addr];
        MyWallet.backupWalletDelayed();
      },
      addAddressBookEntry: function(addr, label) {
        var isValidLabel = MyWallet.isAlphaNumericSpace(label) && MyWallet.isValidAddress(addr);
        if (isValidLabel) {
          address_book[addr] = label;
        }
        return isValidLabel;
      },
      newAddressBookFromJSON: function(addressBook) {
        address_book = {};
        var addEntry = function(e) {this.addAddressBookEntry(e.addr, e.label);};
        if (addressBook !== null && addressBook !== undefined) { 
          addressBook.forEach(addEntry); 
        }
      },
      newLegacyAddressesFromJSON: function(keysArray) {
        var results = [];
        if (keysArray !== null && keysArray !== undefined) {
          result = keysArray.map(unsafeAddLegacyAddress); 
        }
        return results;
      },
      getAddresses: function() {
        return addresses;
      },
      getAddress: function(address) {
        if (address in addresses) {
          return addresses[address];
        } else {
          return null;
        }
      },
      getValueOfLegacyAddress: function(address) {
        if (address in addresses) {
          return parseInt(addresses[address].value);
        } else {
          return 0;
        }
      },
      addToBalanceOfLegacyAddress: function(address, amount) {
        if (address in addresses) {
          addresses[address].balance += amount;
        }
      },
      legacyAddressExists: function(address) {
        return address in addresses;
      },
      getLegacyAddressTag: function(address) {
        if (address in addresses) {
          return addresses[address].tag;
        } else {
          return null;
        }
      },
      setLegacyAddressTag: function(address, tag) {
        addresses[address].tag = tag;
      },
      getLegacyAddressLabel: function(address) {
        if (address in addresses) {
          return addresses[address].label;
        } else {
          return null;
        }
      },
      setLegacyAddressBalance: function(address, balance) {
        addresses[address].balance = balance;
      },
      isActiveLegacyAddress: function(address) {
        return (address in addresses) && (addresses[address].tag !== 2);
      },
      isWatchOnlyLegacyAddress: function(address) {
        return (address in addresses) && (addresses[address].priv == null);
      },
      getLegacyAddressBalance: function(address) {
        if (address in addresses) {
          return addresses[address].balance;
        } else {
          return null;
        }
      },
      getTotalBalanceForActiveLegacyAddresses: function() {
        var add = function(x, y) {return x + y;};
        var balances = [];
        for (k in addresses) {
          if (!hasProp.call(addresses, k)) continue;
          o = addresses[k];
          if (o.tag !== 2) balances.push(o.balance);
        }        
        return balances.reduce(add, 0);
      },
      deleteLegacyAddress: function(address) {
        delete addresses[address];
        MyWallet.backupWalletDelayed();
      },
      getPrivateKey: function(address) {
        if (address in addresses) {
          return addresses[address].priv;
        } else {
          return null;
        }
      },
      setLegacyAddressLabel: function(address, label, success, error) {
        if (label.length > 0 && !MyWallet.isAlphaNumericSpace(label)) {
          return error && error();
        } else {
          addresses[address].label = label;
          MyWallet.backupWalletDelayed();
          return success && success();
        }
      },
      unArchiveLegacyAddr: function(address) {
        var addr;
        addr = addresses[address];
        if (addr.tag === 2) {
          addr.tag = null;
          MyWallet.backupWalletDelayed('update', function() {
            return MyWallet.get_history();
          });
        } else {
          this.sendEvent("msg", {
            type: "error",
            message: 'Cannot Unarchive This Address'
          });
        }
      },
      archiveLegacyAddr: function(address) {
        var addr;
        addr = addresses[address];
        if ((addr.tag === null) || addr.tag === 0) {
          addr.tag = 2;
          MyWallet.backupWalletDelayed('update', function() {
            return MyWallet.get_history();
          });
        } else {
          this.sendEvent("msg", {
            type: "error",
            message: 'Cannot Archive This Address'
          });
        }
      },
      getAllLegacyAddresses: function() {
        var k, results;
        results = [];
        for (k in addresses) {
          if (!hasProp.call(addresses, k)) continue;
          results.push(k);
        }
        return results;
      },
      getPreferredLegacyAddress: function() {
        var k, o;
        return ((function() {
          var results;
          results = [];
          for (k in addresses) {
            if (!hasProp.call(addresses, k)) continue;
            o = addresses[k];
            if ((o.priv != null) && this.isActiveLegacyAddress(k)) {
              results.push(k);
            }
          }
          return results;
        }).call(this))[0];
      },
      hasLegacyAddresses: function() {
        return Object.keys(addresses).length !== 0;
      },
      getLegacyActiveAddresses: function() {
        var k, results;
        results = [];
        for (k in addresses) {
          if (!hasProp.call(addresses, k)) continue;
          if (this.isActiveLegacyAddress(k)) {
            results.push(k);
          }
        }
        return results;
      },
      getLegacyArchivedAddresses: function() {
        var k, results;
        results = [];
        for (k in addresses) {
          if (!hasProp.call(addresses, k)) continue;
          if (!this.isActiveLegacyAddress(k)) {
            results.push(k);
          }
        }
        return results;
      },
      mapToLegacyAddressesPrivateKeys: function(f) {
        var k, o;
        for (k in addresses) {
          if (!hasProp.call(addresses, k)) continue;
          o = addresses[k];
          if (o.priv != null) {
            o.priv = f(o.priv);
          }
        }
      },
      tagLegacyAddressesAsSaved: function() {
        var k, o;
        for (k in addresses) {
          if (!hasProp.call(addresses, k)) continue;
          o = addresses[k];
          if (o.tag === 1) {
            delete o.tag;
          }
        }
      },
      addLegacyAddress: function(address, privKey) {
        var existing;
        existing = addresses[address];
        if ((existing == null) || existing.length === 0) {
          addresses[address] = {
            addr: address,
            priv: privKey,
            balance: null
          };
          return true;
        } else {
          if ((existing.priv == null) && (privKey != null)) {
            existing.priv = privKey;
            return true;
          } else {
            return false;
          }
        }
      },
      getNTransactions: function() {
        return n_tx;
      },
      setNTransactions: function(numberOfTransactions) {
        n_tx = numberOfTransactions;
      },
      incNTransactions: function() {
        n_tx++;
      },
      getFinalBalance: function() {
        return final_balance;
      },
      setFinalBalance: function(amount) {
        final_balance = amount;
      },
      addToFinalBalance: function(amount) {
        final_balance += amount;
      },
      getTotalSent: function() {
        return total_sent;
      },
      setTotalSent: function(amount) {
        total_sent = amount;
      },
      addToTotalSent: function(amount) {
        total_sent += amount;
      },
      getTotalReceived: function() {
        return total_received;
      },
      setTotalReceived: function(amount) {
        total_received = amount;
      },
      addToTotalReceived: function(amount) {
        total_received += amount;
      },
      getNote: function(txHash) {
        if (txHash in tx_notes) {
          return tx_notes[txHash];
        } else {
          return null;
        }
      },
      deleteNote: function(txHash) {
        delete tx_notes[txHash];
        MyWallet.backupWalletDelayed();
      },
      setNote: function(txHash, text) {
        var isValidNote;
        isValidNote = MyWallet.isAlphaNumericSpace(text) && (text != null);
        if (isValidNote) {
          tx_notes[txHash] = text;
          MyWallet.backupWalletDelayed();
        }
        return isValidNote;
      },
      getNotes: function() {
        return tx_notes;
      },
      setDefaultAccountIndex: function(accountIdx) {
        if (accountIdx != null) {
          defaultAccountIdx = accountIdx;
        } else {
          defaultAccountIdx = 0;
        }
        MyWallet.backupWalletDelayed();
      },
      getDefaultAccountIndex: function() {
        return defaultAccountIdx;
      },
      disableLogout: function(value) {
        disable_logout = true;
      },
      isLogoutDisabled: function() {
        return disable_logout;
      },
      getMixerFee: function() {
        return mixer_fee;
      },
      setMixerFee: function(fee) {
        if (fee != null) {
          mixer_fee = fee;
        }
      },
      isAccountRecommendedFeesValid: function() {
        return isAccountRecommendedFeesValid;
      },
      setIsAccountRecommendedFeesValid: function(bool) {
        isAccountRecommendedFeesValid = bool;
      },
      getAmountToRecommendedFee: function(amount) {
        if (amount in amountToRecommendedFee) {
          return amountToRecommendedFee[amount];
        } else {
          return null;
        }
      },
      setAmountToRecommendedFee: function(amount, recFee) {
        amountToRecommendedFee[amount] = recFee;
      },
      getLatestBlock: function() {
        return latest_block;
      },
      setLatestBlock: function(block) {
        var i, len, ref, tx;
        if (block != null) {
          latest_block = block;
          ref = this.getTransactions();
          for (i = 0, len = ref.length; i < len; i++) {
            tx = ref[i];
            tx.setConfirmations(MyWallet.getConfirmationsForTx(latest_block, tx));
          }
          this.sendEvent('did_set_latest_block');
        }
      },
      getAllTags: function() {
        return tx_tags;
      },
      getTags: function(tx_hash) {
        if (tx_hash in tx_tags) {
          return tx_tags[tx_hash];
        } else {
          return [];
        }
      },
      setTags: function(allTags) {
        var tags, tx_hash;
        if (allTags != null) {
          for (tx_hash in allTags) {
            tags = allTags[tx_hash];
            if ((tags != null) && MyWallet.isAlphaNumericSpace(tags)) {
              tx_tags[tx_hash] = tags;
            }
          }
        }
      },
      setTag: function(tx_hash, idx) {
        if (tx_tags[tx_hash] == null) {
          tx_tags[tx_hash] = [];
        }
        tx_tags[tx_hash].push(idx);
        MyWallet.backupWalletDelayed();
      },
      unsetTag: function(tx_hash, idx) {
        var index, tags;
        tags = tx_tags[tx_hash];
        index = tx_tags.indexOf(idx);
        if (index > -1) {
          tx_tags.splice(index, 1);
        }
        MyWallet.backupWalletDelayed();
      },
      deleteTag: function(idx) {
        var index, tags, tx_hash;
        tag_names.splice(idx, 1);
        for (tx_hash in tx_tags) {
          tags = tx_tags[tx_hash];
          index = tx_tags.indexOf(idx);
          if (index > -1) {
            tx_tags.splice(index, 1);
          }
        }
      },
      getTagNames: function() {
        return tag_names;
      },
      addTag: function(name) {
        var isValidTag;
        isValidTag = MyWallet.isAlphaNumericSpace(name);
        if (isValidTag) {
          tag_names.push(name);
          MyWallet.backupWalletDelayed();
        }
        return isValidTag;
      },
      renameTag: function(idx, name) {
        var isValidTag;
        isValidTag = MyWallet.isAlphaNumericSpace(name);
        if (isValidTag) {
          tag_names[idx] = name;
          MyWallet.backupWalletDelayed();
        }
        return isValidTag;
      },
      setTagNames: function(names) {
        if (names != null) {
          tag_names = names;
        }
      },
      setAPICode: function(stringInt) {
        api_code = stringInt;
      },
      getAPICode: function() {
        return api_code;
      },
      isHaveBuildHDWallet: function () {
        return haveBuildHDWallet;
      },
      setHaveBuildHDWallet: function (bool) {
        haveBuildHDWallet = bool;
      },
      getDoubleEncryption: function() {
        return double_encryption;
      },
      setDoubleEncryption: function(bool) {
        double_encryption = bool;
      },
      setRealAuthType: function(number) {
        real_auth_type = number;
      },
      get2FAType: function() {
        return real_auth_type;
      },
      get2FATypeString: function() {
        var stringType = "";
        switch(real_auth_type){
          case 0: stringType = null; break;
          case 1: stringType = "Yubikey"; break;
          case 2: stringType = "Email"; break;
          case 3: stringType = "Yubikey MtGox"; break;
          case 4: stringType = "Google Auth"; break;
          case 5: stringType = "SMS"; break;
          default: stringType = null; break;
        }
        return stringType;
      },
      // probably not used
      setAuthType: function(number) {
        auth_type = number;
      },
      getDemoGuid: function() {
        return demo_guid;
      },
      getGuid: function() {
        return guid;
      },
      setGuid: function(stringValue) {
        guid = stringValue;
      },
      isDemoWallet: function() {
        return guid === demo_guid;
      },
      getDPasswordHash: function() {
        return dpasswordhash;
      },
      setDPasswordHash: function(stringValue) {
        dpasswordhash = stringValue;
      },
      generatePayloadChecksum: function() {
        return CryptoJS.SHA256(encrypted_wallet_data).toString();
      },
      setEncryptedWalletData: function(data) {
        if (!data || data.length == 0) {
          encrypted_wallet_data = null;
          payload_checksum = null;
        }
        else {
          encrypted_wallet_data = data;
          payload_checksum = this.generatePayloadChecksum();
        }
      },
      getEncryptedWalletData: function() {
        return encrypted_wallet_data;
      },
      getPayloadChecksum: function() {
        return payload_checksum;
      },
      setPayloadChecksum: function(value) {
        payload_checksum = value;
      },
      getHDWallet: function() {
        if (typeof myHDWallet === 'undefined') {
          return null;
        }
        return myHDWallet;
      },
      setHDWallet: function(newValue) {
        myHDWallet = newValue;
        if (newValue) {
          this.sendEvent('hd_wallet_set');
        }
      },
      getSharedcoinEndpoint: function() {
        return sharedcoin_endpoint;
      },
      setSharedcoinEndpoint: function(value) {
        sharedcoin_endpoint = value;
      },
      getSharedKey: function() {
        return sharedKey;
      },
      setSharedKey: function(value) {
        sharedKey = value;
      },
      isDidSetGuid: function () {
        return didSetGuid;
      },
      setDidSetGuid: function () {
        didSetGuid = true;
      },
      isPolling: function () {
        return isPolling;
      },
      setIsPolling: function (bool) {
        isPolling = bool;
      },
      // not used
      getLocalWalletJson: function() {
        var obj = null;
        try {
          var obj = $.parseJSON(localWalletJsonString);
          return obj;
        } catch (e) {
          return null;
        }
      },
      // this probably can be deleted too
      setLocalWalletJson: function(data){
        localWalletJsonString = data;
      },
      getLegacyAddressesNumTxFetched: function(){
        return legacyAddressesNumTxFetched;
      },
      addLegacyAddressesNumTxFetched: function (number){
        legacyAddressesNumTxFetched += number;
      },
      // probably useless too: it is set but never called the getter
      getRecommendIncludeFee: function() {
        return recommend_include_fee;
      },
      setRecommendIncludeFee: function(value) {
        recommend_include_fee = value;
      },
      getDefaultPbkdf2Iterations: function() {
        return default_pbkdf2_iterations;
      },
      isRestoringWallet: function() {
        return isRestoringWallet;
      },
      setRestoringWallet: function (bool) {
        isRestoringWallet = bool;
      },
      incrementCounter: function () {
        counter = counter + 1;
      },
      getCounter: function () {
        return counter;
      },
      // looks like there are two different timeouts. One inside wallet options. 
      // maybe one is a redundant old thing.
      getLogoutTimeout: function () {
        return logout_timeout;
      },
      setLogoutTimeout: function (value) {
        logout_timeout = value;
      },
      setSyncPubKeys: function (bool){
        sync_pubkeys = bool;
      },
      isSyncPubKeys: function (){
        return sync_pubkeys;
      },
      isSynchronizedWithServer: function (){
        return isSynchronizedWithServer;
      },
      setIsSynchronizedWithServer: function (bool){
        isSynchronizedWithServer = bool;
      },
      isHaveSetServerTime: function (){
        return haveSetServerTime;
      },
      setHaveSetServerTime: function (){
        haveSetServerTime = true;
      },
      getServerTimeOffset: function (){
        return serverTimeOffset;
      },
      setServerTimeOffset: function (offset){
        serverTimeOffset = offset;
      },
      getNumOldTxsToFetchAtATime: function (){
        return numOldTxsToFetchAtATime;
      },
      addEventListener: function(func){
        event_listeners.push(func);
      },
      sendEvent: function(event_name, obj){
        for (var listener in event_listeners) {
          event_listeners[listener](event_name, obj);
        }
      },
      isCorrectMainPassword: function(candidate){
        return password === candidate;
      },
      changePassword: function(new_password, success, error){
        password = new_password;
        MyWallet.backupWallet('update', function(){
          if (success)
            success();
        }, function() {
          if (error)
            error();
        });
      },
      unsafeSetPassword: function(newPassword){
        password = newPassword;
      },
      getPassword: function(){
        return password;
      } 
    };
  })();

}).call(this);