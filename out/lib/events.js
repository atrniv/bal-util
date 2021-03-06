// Generated by CoffeeScript 1.6.2
(function() {
  var Event, EventEmitter, EventEmitterEnhanced, EventSystem, balUtilFlow, balUtilTypes, debug, _ref, _ref1,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  EventEmitter = require('events').EventEmitter;

  balUtilFlow = require('./flow');

  balUtilTypes = require('./types');

  debug = false;

  EventEmitterEnhanced = (function(_super) {
    __extends(EventEmitterEnhanced, _super);

    function EventEmitterEnhanced() {
      _ref = EventEmitterEnhanced.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    EventEmitterEnhanced.prototype.getListenerGroup = function(eventName, data, next) {
      var listeners, me, tasks;

      me = this;
      listeners = this.listeners(eventName);
      tasks = new balUtilFlow.Group(next);
      balUtilFlow.each(listeners, function(listener) {
        if (listener.listener) {
          listener = [listener, listener.listener];
        }
        return tasks.push(function(complete) {
          return balUtilFlow.fireWithOptionalCallback(listener, [data, complete], me);
        });
      });
      return tasks;
    };

    EventEmitterEnhanced.prototype.emitSync = function() {
      var args;

      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.emitSerial.apply(this, args);
    };

    EventEmitterEnhanced.prototype.emitSerial = function() {
      var args;

      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.getListenerGroup.apply(this, args).run('serial');
    };

    EventEmitterEnhanced.prototype.emitAsync = function() {
      var args;

      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.emitParallel.apply(this, args);
    };

    EventEmitterEnhanced.prototype.emitParallel = function() {
      var args;

      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.getListenerGroup.apply(this, args).run('parallel');
    };

    return EventEmitterEnhanced;

  })(EventEmitter);

  Event = (function() {
    Event.prototype.name = null;

    Event.prototype.locked = false;

    Event.prototype.finished = false;

    function Event(_arg) {
      this.name = _arg.name;
    }

    return Event;

  })();

  EventSystem = (function(_super) {
    __extends(EventSystem, _super);

    function EventSystem() {
      _ref1 = EventSystem.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    EventSystem.prototype._eventSystemEvents = null;

    EventSystem.prototype.event = function(eventName) {
      var _base;

      this._eventSystemEvents || (this._eventSystemEvents = {});
      return (_base = this._eventSystemEvents)[eventName] || (_base[eventName] = new Event(eventName));
    };

    EventSystem.prototype.lock = function(eventName, next) {
      var err, event,
        _this = this;

      event = this.event(eventName);
      if (event.locked === false) {
        event.locked = true;
        try {
          this.emit(eventName + ':locked');
        } catch (_error) {
          err = _error;
          next(err);
          return this;
        } finally {
          next();
        }
      } else {
        this.onceUnlocked(eventName, function(err) {
          if (err) {
            return next(err);
          }
          return _this.lock(eventName, next);
        });
      }
      return this;
    };

    EventSystem.prototype.unlock = function(eventName, next) {
      var err, event;

      event = this.event(eventName);
      event.locked = false;
      try {
        this.emit(eventName + ':unlocked');
      } catch (_error) {
        err = _error;
        next(err);
        return this;
      } finally {
        next();
      }
      return this;
    };

    EventSystem.prototype.start = function(eventName, next) {
      var _this = this;

      this.lock(eventName, function(err) {
        var event;

        if (err) {
          return next(err);
        }
        event = _this.event(eventName);
        event.finished = false;
        try {
          return _this.emit(eventName + ':started');
        } catch (_error) {
          err = _error;
          next(err);
          return _this;
        } finally {
          next();
        }
      });
      return this;
    };

    EventSystem.prototype.finish = function() {
      var args;

      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.finished.apply(this, args);
    };

    EventSystem.prototype.finished = function(eventName, next) {
      var event,
        _this = this;

      event = this.event(eventName);
      event.finished = true;
      this.unlock(eventName, function(err) {
        if (err) {
          return next(err);
        }
        try {
          return _this.emit(eventName + ':finished');
        } catch (_error) {
          err = _error;
          next(err);
          return _this;
        } finally {
          next();
        }
      });
      return this;
    };

    EventSystem.prototype.onceUnlocked = function(eventName, next) {
      var event;

      event = this.event(eventName);
      if (event.locked) {
        this.once(eventName + ':unlocked', next);
      } else {
        next();
      }
      return this;
    };

    EventSystem.prototype.onceFinished = function(eventName, next) {
      var event;

      event = this.event(eventName);
      if (event.finished) {
        next();
      } else {
        this.once(eventName + ':finished', next);
      }
      return this;
    };

    EventSystem.prototype.whenFinished = function(eventName, next) {
      var event;

      event = this.event(eventName);
      if (event.finished) {
        next();
      }
      this.on(eventName + ':finished', next);
      return this;
    };

    EventSystem.prototype.when = function() {
      var args;

      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.on.apply(this, args);
    };

    EventSystem.prototype.block = function(eventNames, next) {
      var done, err, eventName, total, _i, _len;

      if (!balUtilTypes.isArray(eventNames)) {
        if (balUtilTypes.isString(eventNames)) {
          eventNames = eventNames.split(/[,\s]+/g);
        } else {
          err = new Error('Unknown eventNames type');
          return next(err);
        }
      }
      total = eventNames.length;
      done = 0;
      for (_i = 0, _len = eventNames.length; _i < _len; _i++) {
        eventName = eventNames[_i];
        this.lock(eventName, function(err) {
          if (err) {
            done = total;
            return next(err);
          }
          done++;
          if (done === total) {
            return next();
          }
        });
      }
      return this;
    };

    EventSystem.prototype.unblock = function(eventNames, next) {
      var done, err, eventName, total, _i, _len;

      if (!balUtilTypes.isArray(eventNames)) {
        if (balUtilTypes.isString(eventNames)) {
          eventNames = eventNames.split(/[,\s]+/g);
        } else {
          err = new Error('Unknown eventNames type');
          return next(err);
        }
      }
      total = eventNames.length;
      done = 0;
      for (_i = 0, _len = eventNames.length; _i < _len; _i++) {
        eventName = eventNames[_i];
        this.unlock(eventName, function(err) {
          if (err) {
            done = total;
            return next(err);
          }
          done++;
          if (done === total) {
            return next();
          }
        });
      }
      return this;
    };

    return EventSystem;

  })(EventEmitterEnhanced);

  module.exports = {
    EventEmitterEnhanced: EventEmitterEnhanced,
    Event: Event,
    EventSystem: EventSystem
  };

}).call(this);
