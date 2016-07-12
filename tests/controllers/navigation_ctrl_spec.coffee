describe "NavigationCtrl", ->
  scope = undefined
  Wallet = undefined

  whatsNew = [
    { date: 1, title: 'feat1' },
    { date: 4, title: 'feat2' }
  ]

  beforeEach angular.mock.module("walletApp")

  beforeEach ->
    angular.mock.inject ($cookies, $injector, $rootScope, $controller) ->
      Wallet = $injector.get("Wallet")
      MyWallet = $injector.get("MyWallet")
      Alerts = $injector.get("Alerts")

      Alerts.confirm = (msg) ->
        then: (f) ->
          if msg != 'CHANGES_BEING_SAVED'
            f(true)

      Wallet.status = {
        isLoggedIn: true
      }

      Wallet.settings = {
        secondPassword: false
      }

      MyWallet.logout = () ->
        Wallet.status.isLoggedIn = false

      MyWallet.sync = () ->
        Wallet.store.setIsSynchronizedWithServer(false)

      Wallet.isSynchronizedWithServer = () ->
        Wallet.store.isSynchronizedWithServer()

      Wallet.store.setIsSynchronizedWithServer(true)

      spyOn($cookies, 'get').and.returnValue(2)

      scope = $rootScope.$new()

      $controller "NavigationCtrl",
        $scope: scope,
        whatsNew: whatsNew

      return

    return

  it "should have access to login status",  inject(() ->
    expect(scope.status.isLoggedIn).toBe(true)
  )

  it "should logout",  inject((Wallet, $stateParams, $state, $uibModal) ->
    spyOn(Wallet, "logout").and.callThrough()
    spyOn($state, "go")

    scope.logout()

    expect(Wallet.logout).toHaveBeenCalled()
    expect(scope.status.isLoggedIn).toBe(false)
  )

  it "should not logout if save is in progress",  inject((Wallet, MyWallet, $stateParams) ->
    spyOn(Wallet, "logout").and.callThrough()

    MyWallet.sync()
    scope.logout()

    expect(Wallet.logout).not.toHaveBeenCalled()
    expect(scope.status.isLoggedIn).toBe(true)
  )

  describe "whats new", ->
    it "should have the whats new template", ->
      expect(scope.whatsNewTemplate).toEqual('templates/whats-new.jade')

    it "should have the feature array injected", ->
      expect(scope.feats.length).toEqual(2)

    describe "without 2nd password", ->
      beforeEach ->
        scope.initialize();

      it "should get the last viewed time from metadata service", ->
        expect(scope.lastViewedWhatsNew).toEqual(3)

      it "should calculate the correct number of latest feats", ->
        expect(scope.nLatestFeats()).toEqual(1)

      it "should update metadata service when new is viewed", inject(($timeout) ->
        spyOn(scope.metaData, 'update')
        spyOn(Date, 'now').and.returnValue(4)
        expect(scope.nLatestFeats()).toEqual(1)
        scope.viewedWhatsNew()
        $timeout.flush()
        expect(scope.metaData.update).toHaveBeenCalledWith({lastViewed: 4})
        expect(scope.nLatestFeats()).toEqual(0)
      )

    describe "without 2nd password if metadata service is down", ->
      beforeEach ->
        scope.initialize(true);

      it "should get the last viewed time from a cookie", ->
        expect(scope.lastViewedWhatsNew).toEqual(2)

      it "should calculate the correct number of latest feats", ->
        expect(scope.nLatestFeats()).toEqual(1)

      it "should set new cookie when whats new is viewed", inject(($cookies, $timeout) ->
        spyOn($cookies, 'put')
        spyOn(Date, 'now').and.returnValue(4)
        expect(scope.nLatestFeats()).toEqual(1)
        scope.viewedWhatsNew()
        $timeout.flush()
        expect($cookies.put).toHaveBeenCalledWith('whatsNewViewed', 4)
        expect(scope.nLatestFeats()).toEqual(0)
      )

    describe "when 2nd password is enabled", ->
      beforeEach ->
        Wallet.settings.secondPassword = true
        scope.initialize()

      it "should get the last viewed time from a cookie", ->
        expect(scope.lastViewedWhatsNew).toEqual(2)

      it "should calculate the correct number of latest feats", ->
        expect(scope.nLatestFeats()).toEqual(1)

      it "should set new cookie when whats new is viewed", inject(($cookies, $timeout) ->
        spyOn($cookies, 'put')
        spyOn(Date, 'now').and.returnValue(4)
        expect(scope.nLatestFeats()).toEqual(1)
        scope.viewedWhatsNew()
        $timeout.flush()
        expect($cookies.put).toHaveBeenCalledWith('whatsNewViewed', 4)
        expect(scope.nLatestFeats()).toEqual(0)
      )
