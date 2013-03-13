'use strict';

function injectData(app, data) {
  var d = data || {
    'result': [
      ['service', 'add',
       {'charm': 'cs:precise/wordpress-6',
         'id': 'wordpress', 'exposed': false}],
      ['service', 'add', {'charm': 'cs:precise/mysql-6', 'id': 'mysql'}],
      ['relation', 'add',
       {'interface': 'reversenginx', 'scope': 'global',
         'endpoints': [['wordpress', {'role': 'peer', 'name': 'loadbalancer'}]],
         'id': 'relation-0000000002'}],
      ['relation', 'add',
       {'interface': 'mysql',
         'scope': 'global', 'endpoints':
         [['mysql', {'role': 'server', 'name': 'db'}],
           ['wordpress', {'role': 'client', 'name': 'db'}]],
         'id': 'relation-0000000001'}],
      ['machine', 'add',
       {'agent-state': 'running', 'instance-state': 'running',
         'id': 0, 'instance-id': 'local', 'dns-name': 'localhost'}],
               ['unit', 'add',
                {'machine': 0, 'agent-state': 'started',
          'public-address': '192.168.122.113', 'id': 'wordpress/0'}],
      ['unit', 'add',
       {'machine': 0, 'agent-state': 'started',
                  'public-address': '192.168.122.222', 'id': 'mysql/0'}]],
    'op': 'delta'};
  app.env.dispatch_result(d);
  return app;
}

(function() {

  describe('Application basics', function() {
    var Y, app, container;

    before(function(done) {
      Y = YUI(GlobalConfig).use(
          ['juju-gui', 'juju-tests-utils', 'juju-view-utils'],
          function(Y) {
            done();
          });
    });

    beforeEach(function() {
      container = Y.one('#main')
        .appendChild(Y.Node.create('<div/>'))
          .set('id', 'test-container')
          .addClass('container')
          .append(Y.Node.create('<span/>')
            .set('id', 'environment-name'))
          .append(Y.Node.create('<span/>')
            .addClass('provider-type'))
          .hide();
      app = new Y.juju.App(
          { container: container,
            viewContainer: container});
      injectData(app);
    });

    afterEach(function() {
      container.remove(true);
      sessionStorage.setItem('credentials', null);
    });

    it('should not have login credentials if missing from the configuration',
        function() {
          app.render();
          assert.equal(app.env.get('user'), undefined);
          assert.equal(app.env.get('password'), undefined);
        });

    it('should propagate login credentials from the configuration',
        function() {
          var the_username = 'nehi';
          var the_password = 'moonpie';
          // Replace the existing app.
          app = new Y.juju.App(
              { container: container,
                user: the_username,
                password: the_password,
                viewContainer: container});
          var credentials = app.env.getCredentials();
          credentials.user.should.equal(the_username);
          credentials.password.should.equal(the_password);
        });

    it('propagates the readOnly option from the configuration', function() {
      // Replace the existing app.
      app = new Y.juju.App({
        container: container,
        readOnly: true,
        viewContainer: container});
      assert.isTrue(app.env.get('readOnly'));
    });

    it('should produce a valid index', function() {
      var container = app.get('container');
      app.render();
      container.getAttribute('id').should.equal('test-container');
      container.getAttribute('class').should.include('container');
    });

    it('should be able to route objects to internal URLs', function() {
      // Take handles to database objects and ensure we can route to the view
      // needed to show them.
      var wordpress = app.db.services.getById('wordpress'),
          wp0 = app.db.units.get_units_for_service(wordpress)[0],
          wp_charm = app.db.charms.add({id: wordpress.get('charm')});

      // 'service/wordpress/' is the primary route,
      // so other URLs are not returned.
      app.getModelURL(wordpress).should.equal('/service/wordpress/');
      // However, passing 'intent' can force selection of another one.
      app.getModelURL(wordpress, 'config').should.equal(
          '/service/wordpress/config/');

      // Service units use argument rewriting (thus not /u/wp/0).
      app.getModelURL(wp0).should.equal('/unit/wordpress-0/');

      // Charms also require a mapping, but only a name, not a function.
      app.getModelURL(wp_charm).should.equal(
          '/charms/charms/precise/wordpress-6/json/');
    });

    it('should display the configured environment name', function() {
      var environment_name = 'This is the environment name.  Deal with it.';
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            environment_name: environment_name});
      assert.equal(
          container.one('#environment-name').get('text'),
          environment_name);
    });

    it('should show a generic environment name if none configured',
       function() {
         app = new Y.juju.App(
         { container: container,
           viewContainer: container});
         assert.equal(
         container.one('#environment-name').get('text'),
         'Environment');
       });

    it('should show the provider type, when available', function() {
      var providerType = 'excellent provider';
      // Since no provider type has been set yet, none is displayed.
      assert.equal('', container.one('.provider-type').get('text'));
      app.env.set('providerType', providerType);
      // The provider type has been displayed.
      assert.equal(
          'on ' + providerType,
          container.one('.provider-type').get('text')
      );
    });

  });
})();


(function() {

  describe('Application authentication', function() {
    var conn, env, juju, utils, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use(['juju-gui', 'juju-tests-utils'], function(Y) {
        utils = Y.namespace('juju-tests.utils');
        juju = Y.namespace('juju');
        done();
      });
    });

    beforeEach(function(done) {
      conn = new utils.SocketStub();
      env = juju.newEnvironment({conn: conn});
      env.connect();
      env.setCredentials({user: 'user', password: 'password'});
      done();
    });

    afterEach(function(done)  {
      sessionStorage.setItem('credentials', null);
      env.destroy();
      done();
    });

    it('should avoid trying to login if the env is not connected',
       function(done) {
         var app = new Y.juju.App({env: env});
         app.after('ready', function() {
           assert.equal(0, conn.messages.length);
           done();
         });
       });

    it('should try to login if the env connection is established',
       function(done) {
         env.setAttrs({user: 'user', password: 'password'});
         conn.open();
         var app = new Y.juju.App({env: env});
         app.after('ready', function() {
           assert.equal('login', conn.last_message().op);
           done();
         });
       });

    it('should not try to login if user and password are not provided',
       function(done) {
         env.setCredentials(null);
         conn.open();
         var app = new Y.juju.App({env: env});
         app.after('ready', function() {
           assert.equal(0, conn.messages.length);
           done();
         });
       });

    it('should allow logging out', function() {
      env.logout();
      assert.equal(false, env.userIsAuthenticated);
      assert.equal(null, env.getCredentials());
    });

  });
})();


(function() {

  describe('Application Connection State', function() {
    var container, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use(['juju-gui', 'juju-tests-utils'],
          function(Y) {
            container = Y.Node.create(
                '<div id="test" class="container"></div>');
            done();
          });
    });

    it('should be able to handle env connection status changes', function() {
      var juju = Y.namespace('juju'),
          conn = new(Y.namespace('juju-tests.utils')).SocketStub(),
          env = juju.newEnvironment({
            conn: conn,
            user: 'user',
            password: 'password'
          }),
          app = new Y.juju.App({env: env, container: container}),
          reset_called = false,
          dispatch_called = false,
          login_called = false,
          noop = function() {return this;};

      // Mock the database.
      app.db = {
        // Mock out notifications, so the application can start normally.
        notifications: {
          addTarget: noop,
          after: noop,
          filter: noop,
          map: noop,
          on: noop,
          size: function() {return 0;}
        },
        reset: function() {
          reset_called = true;
        }
      };
      app.dispatch = function() {
        // We want to verify that we are called after the value is set, so
        // check_user_credentials can look at this value reliably.
        if (env.get('connected')) {
          dispatch_called = true;
        }
      };
      env.login = function() {
        login_called = true;
      };
      env.connect();
      conn.open();
      // We need to fake the connection event.
      reset_called.should.equal(true);
      dispatch_called.should.equal(true);
      login_called.should.equal(true);

      // Trigger a second time and verify.
      conn.transient_close();
      reset_called = false;
      dispatch_called = false;
      login_called = false;
      conn.open();
      reset_called.should.equal(true);
      dispatch_called.should.equal(true);
      login_called.should.equal(true);
    });

  });
})();


(function() {

  describe('Application prefetching', function() {
    var Y, conn, env, app, container;

    before(function(done) {
      console.log('Loading App prefetch test code');
      Y = YUI(GlobalConfig).use(
          ['juju-gui', 'juju-views', 'juju-tests-utils'], function(Y) {
            done();
          });
    });

    beforeEach(function() {
      conn = new (Y.namespace('juju-tests.utils')).SocketStub(),
      env = Y.juju.newEnvironment({conn: conn});
      env.connect();
      conn.open();
      container = Y.Node.create('<div id="test" class="container"></div>');
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            env: env,
            charm_store: {} });
      env.get_endpoints = function() {};
    });

    afterEach(function() {
      container.destroy();
      app.destroy();
    });

    it('must prefetch charm and service for service pages', function() {
      injectData(app);
      var _ = expect(
          app.db.charms.getById('cs:precise/wordpress-6')).to.not.exist;
      app.show_service({params: {id: 'wordpress'}, query: {}});
      // The app made a request of juju for the service info.
      conn.messages[conn.messages.length - 2].op.should.equal('get_service');
      // The app also requested juju (not the charm store--see discussion in
      // app/models/charm.js) for the charm info.
      conn.last_message().op.should.equal('get_charm');
      // Tests of the actual load machinery are in the model and env tests, and
      // so are not repeated here.
    });

    it('must request endpoints only when necessary', function() {
      var get_endpoints_count = 0,
          tmp_data = {
            result: [
              ['service', 'add', {
                'charm': 'cs:precise/mysql-6',
                'id': 'mysql2'
              }],
              ['unit', 'add', {
                'machine': 0,
                'agent-state': 'started',
                'public-address': '192.168.122.222',
                'id': 'mysql2/0'
              }]
            ],
            op: 'delta'
          };
      env.get_endpoints = function(services, callback) {
        get_endpoints_count += 1;
      };
      // Inject default data, should only get_endpoints once.
      injectData(app);
      get_endpoints_count.should.equal(1);
      // Additional deltas should only call get_endpoints once.
      app.db.on_delta({ data: tmp_data });
      get_endpoints_count.should.equal(2);
    });
  });
})();

(function() {
  describe('configuration parsing', function() {

    var Y, app, container, getLocation;

    before(function(done) {
      console.log('Loading App prefetch test code');
      Y = YUI(GlobalConfig).use(
          ['juju-gui'], function(Y) {
            done();
          });
    });

    beforeEach(function() {
      container = Y.Node.create('<div id="test" class="container"></div>');
      // Monkey patch.
      getLocation = Y.getLocation;
      Y.getLocation = function() {
        return {port: 71070, hostname: 'example.net'};
      };
    });

    afterEach(function() {
      Y.getLocation = getLocation;
      container.destroy();
      app.destroy();
    });

    it('should honor socket_url', function() {
      // The app passes it through to the environment.
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            socket_url: 'wss://example.com/' });
      assert.equal(app.env.get('socket_url'), 'wss://example.com/');
    });

    it('should honor socket_port', function() {
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            socket_port: '8080' });
      assert.equal(
          app.env.get('socket_url'),
          'wss://example.net:8080/ws');
    });

    it('should honor socket_protocol', function() {
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            socket_protocol: 'ws' });
      assert.equal(
          app.env.get('socket_url'),
          'ws://example.net:71070/ws');
    });

    it('should support combining socket_port and socket_protocol', function() {
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            socket_protocol: 'ws',
            socket_port: '8080' });
      assert.equal(
          app.env.get('socket_url'),
          'ws://example.net:8080/ws');
    });

    it('should allow socket_port to override socket_url', function() {
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            socket_port: '8080',
            socket_url: 'fnord' });
      assert.equal(
          app.env.get('socket_url'),
          'wss://example.net:8080/ws');
    });

    it('should allow socket_protocol to override socket_url', function() {
      app = new Y.juju.App(
          { container: container,
            viewContainer: container,
            socket_protocol: 'ws',
            socket_url: 'fnord' });
      assert.equal(
          app.env.get('socket_url'),
          'ws://example.net:71070/ws');
    });

  });
})();
