define(function (require, exports, module) {
  var EventProxy = require('utils/EventProxy');

  /** 
   * 对Backbone.History进行扩展，
   * 模拟一个历史记录栈，从而实现历史后退的接口。
   */
  var History = Backbone.History;
  _.extend(History.prototype, {
    // reject history stack
    _historyStacks: [],
    getLastFragment: function () {
      return this._historyStacks[this._historyStacks.length - 1] || '';
    },
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current === this.fragment && this.iframe) {
        current = this.getFragment(this.getHash(this.iframe));
      }
      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      // --- reject stack 
      this._historyStacks.push(this.fragment);
      // --- reject end
      this.loadUrl();
    },
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};
      var url = this.root + (fragment = this.getFragment(fragment || ''));
      fragment = fragment.replace(pathStripper, '');
      if (this.fragment === fragment) return;
      this.fragment = fragment;
      if (fragment === '' && url !== '/') url = url.slice(0, -1);
      // --- reject stack 
      if (options.replace) {
        this._historyStacks.pop();
      }
      this._historyStacks.push(this.fragment);
      // --- reject end
      if (this._hasPushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (getFragment !== this.getFragment(this.getHash(this.iframe)))) {
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },
    back: function (options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};
      var fragment = this.getLastFragment();
      this.fragment = fragment;
      // --- reject stack 
      this._historyStacks.pop();
      // --- reject end
      this.history.back();
      if (options.trigger) return this.loadUrl(fragment);
    }
  });

  var Animate = function () {

  };

  Animate.prototype.hide = function (name) {
    var className = 'stage-animate-' + 'hide-' + name;
  };

  /**
   * Stage 
   * 驱动视图切换
   * @param {number} speed 转场速度
   * @chainable
   */
  var Stage = function (speed) {
    if (!(this instanceof Stage)) {
      return new Stage(router, speed);
    }
    // 设置转场速度
    this._speed = speed || 400;
    // 取Backbone.history的单例
    this._history = Backbone.history;
    // 初始化标记
    this._flag = {
      locked: false
    };
    // 设置可用动画
    this._animates = [
      'slide-top', 'slide-right', 'slide-bottom', 'slide-left',
      'bounce-top', 'bounce-right', 'bounce-bottom', 'bounce-left',
      'opacity',
    ];
    // 转场动画样式的字符串集合，用于removeClass
    this._in = this._out = '';
    // 缓存转场任务，主要用于异步执行完成后的去锁
    this.mission = void 0;
    // 缓存当前视图
    this._currentView = void 0;
    // 初始化转场动画样式的字符串集合
    this._initializeAnimateKeys();
    // 执行自定义的初始化方法
    this.initialize();
    return this;
  };

  /**
   * 生成转场动画样式的字符串集合
   */
  Stage.prototype._initializeAnimateKeys = function () {
    var inAnimate, outAnimate;
    var i, len;
    inAnimate = 'stage-animate-in';
    outAnimate = 'stage-animate-out';
    for (i = 0, len = _animates.length) {
      inAnimate.push('stage-animate-in-' + _animates[i]);
      outAnimate.push('stage-animate-out-' + _animates[i]);
    }
    this._in = inAnimate.join(' ');
    this._out = outAnimate.join(' ');
    return this;
  };

  /**
   * 设置路径->视图(fragment->view)的映射关系
   */
  Stage.prototype.setMap = function (map) {
    var collection = [];
    _.each(map, function (value, key) {
      collection.push({route: Backbone.Router.prototype._routeToRegExp(key), view: value});
    });
    this._map = collection;
    return this;
  };

  /**
   * 根据路径获取对应视图
   */
  Stage.prototype.getView = function (fragment) {
    var view;
    _.any(this._map, function (rule) {
      if (rule.route.test(fragment)) {
        view = rule.view;
        return true;
      }
    });
    return view;
  }; 

  /**
   * 取当前视图
   */
  Stage.prototype.getCurrentView = function () {
    return this._currentView;
  };

  /**
   * 设置当前视图
   */
  Stage.prototype.setCurrentView = function (view) {
    this._currentView = view;
    return this;
  };

  /**
   * 取上一个历史记录
   */
  Stage.prototype.getLastFragment = function () {
    return this._history.getLastFragment();
  };

  /**
   * 取动画样式
   * @param  {string} type 类型，入场或出场，对应in和out
   * @param  {string} key  动画名，如果留空或者找不到该动画则会返回默认的转场样式
   * @return {string}      动画样式
   */
  Stage.prototype.getAnimateClass = function (type, key) {
    if (typeof type !== 'string' || (type !== 'in' && type !== 'out')) {
      throw new Error('the type have to be "in" or "out"');
    }
    if (typeof key === 'string' && key in this._animates) {
      return 'stage-animate-' + type + '-' + this._animates['key'];
    } else {
      return 'stage-animate-' + type;
    }
  };

  /**
   * 初始化方法
   * @method initialize
   * @for Stage 
   * @return {Stage}        this
   * @chainable
   */
  Stage.prototype.initialize = function () {
    return this;
  };

  /**
   * 播放转场动画
   * @param  {Backbone.View} inView     入场视图
   * @param  {Backbone.View} outView    出场视图
   * @param  {array|object|string} transition 转场动画
   * @return {Stage}            this
   */
  Stage.prototype._playAnimate = function (inView, outView, transition) {
    var self = this;
    var inCls, outCls;
    // 取转场动画
    if (transition instanceof Array) {
      // 当transition形式为[in, out] || [in] || []
      inCls = self.getAnimateClass('in', transition[0]);
      outCls = self.getAnimateClass('out', transition[1]);
    } else if (typeof transition === 'object') {
      // 当transition形式为{in: in, out: out} || {in: in} || {out: out} || {}
      inCls = self.getAnimateClass('in', transition['in']);
      outCls = self.getAnimateClass('out', transition['out']);
    } else if (typeof transition === 'string') {
      // 当transition形式为"IN OUT" || "IN" || ""
      transition = transition.split(' ');
      inCls = self.getAnimateClass('in', transition[0]);
      outCls = self.getAnimateClass('out', transition[1]);
    }
    // 更新转场样式
    inView.$el.removeClass(self._out).addClass(inCls);
    outView.$el.removeClass(self._in).addClass(outCls);
    // 动画结束后即完成入场和出场的任务
    setTimeout(function () {
      self.mission.trigger('in');
      self.mission.trigger('out');
    }, self._speed);
    return self;
  };

  /**
   * 切换视图
   * @method  change
   * @for Stage 
   * @param  {string} fragment   路由地址
   * @param  {array} transition 转场动画，长度为二的数组，对应入场和出场
   * @param  {object} options    可选项，将传递到Backbone.history.navigate
   * @return {Stage}            this
   * @chainable
   */
  Stage.prototype.change = function (fragment, transition, options) {
    var self = this;
    var outView, inView;
    // 判断是否被锁定
    if (self._flag.locked) {
      return false;
    }
    // 加锁，防止重复触发跳转
    self._flag.locked = true;
    // 初始化任务(可异步)，只有当所有任务结束才可以去锁
    self.mission = new EventProxy();
    self.mission.all('in', 'out', 'navigate', function () {
      self._flag.locked = false;
    });
    // 初始化选项值
    _.defaults((options = options || {}), {trigger: true});
    // 取出要进行转场的两个视图，并更新保存当前视图的缓存
    inView = self.getView(fragment);
    outView = self.getCurrentView();
    self.setCurrentView(inView);
    // 调用路由方法，进行跳转
    self._history.navigate(fragment, options);
    // 跳转任务完成
    self.mission.trigger('navigate');
    // 进行转场任务
    self._playAnimate(inView, outView, transition);
    return this;
  };

  /**
   * 后退
   * @method  back
   * @for Stage 
   * @param  {array} transition 转场动画，长度为二的数组，对应入场和出场
   * @return {Stage}            this
   * @chainable
   */
  Stage.prototype.back = function (transition, options) {
    var self = this;
    var outView, inView;
    var fragment;
    // 判断是否被锁定
    if (self._flag.locked) {
      return false;
    }
    // 加锁，防止重复触发跳转
    self._flag.locked = true;
    // 初始化任务(可异步)，只有当所有任务结束才可以去锁
    self.mission = new EventProxy();
    self.mission.all('in', 'out', 'navigate', function () {
      self._flag.locked = false;
    });
    // 初始化选项值。与navigate不同，back默认时trigger应为false
    _.defaults((options = options || {}), {trigger: false});
    // 取上一个历史记录的地址作为目标地址
    fragment = this.getLastFragment();
    // 取出要进行转场的两个视图，并更新保存当前视图的缓存
    inView = self.getView(fragment);
    outView = self.getCurrentView();
    self.setCurrentView(inView);
    // 调用路由方法，进行跳转
    self._history.back(options);
    // 跳转任务完成
    self.mission.trigger('navigate');
    // 进行转场任务
    self._playAnimate(inView, outView, transition);
    return this;
  };

  return Stage;
});