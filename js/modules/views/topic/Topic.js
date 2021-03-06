define(function (require, exports, module) {
  var art = require('utils/artTemplate/index');
  var ui = require('utils/ui/index');
  var BasicView = require('modules/views/abstracts/Basic');
  var PostInTopicCollection = require('modules/daos/topic/PostInTopicCollection');
  var tpl = require('templates/topic/topic.tpl');
  var RowTopicView = require('modules/views/topic/Row');
  var sliceSubject = require('utils/common').sliceSubject;
  var iScrollPull = require('utils/iScrollPull');
  var appCache = require('modules/AppCache').appCache;
  var Notification = require('utils/Notification');

  var TopicView = BasicView.extend({
    el: '#topic',
    tpl: art.compile(tpl),
    flag: {
      active: false
    },
    events: {
      'singleTap .action-back': 'action-back',
      'singleTap .action-skip': function () {
        var self = this;
        var maxPage = this.collection.cache.pageCount;
        var tid = this.collection.cache.tid;
        Notification.prompt('跳转到指定页', function (result) {
          var page;
          if (result) {
            page = result['input1'];
            if (result['buttonIndex'] === 2 && page) {
              page = page > maxPage ? maxPage : page;
              Backbone.stage.change('#!/topic/' + tid + '/p' + page, [], {replace: true});
              // self.fetch({tid: tid, page: page});
            }
          }
        }, '跳转', ['yamie', 'biu~'], (maxPage + ''));
      },
      'singleTap .action-reply': function () {
        Backbone.stage.change('#!/publish/' + this.collection.cache.fid + '/' + this.collection.cache.tid, ['slide-right', 'slide-left']);
        appCache.get('publishView').$el.find('header .subject').text(sliceSubject('回复'));
      },
      'singleTap .action-share': function () {
        window.plugins.socialsharing.share(null, null, 'nga://topic/' + this.collection.cache.tid, null);
        var url = 'http://bbs.ngacn.cc/read.php?tid=' + this.collection.cache.tid;
        $(document).on('deviceready', function () {
          cordova && cordova.require('com.verso.cordova.clipboard.Clipboard').copy(url, function () {
            Notification.alert('帖子地址已复制到粘贴板');
          }, function () {
            Notification.alert('分享失败');
          });
        }, false);
      },
      'singleTap .ubb-collapse': function () {
        this.scroll.refresh();
      },
      'swipeUp': function () {
        var $footer = this.$footer;
        $footer.addClass('hide');
        _.delay(function () {
          $footer.addClass('behind');
        }, 400);
      },
      'swipeDown': function () {
        var $footer = this.$footer;
        $footer.removeClass('behind').removeClass('hide');
      },
      'singleTap': function () {
        var $footer = this.$footer;
        $footer.removeClass('behind').removeClass('hide');
      },
      'edgeRightEnd': function (e) {
        var self = this;
        var fullWidth = document.documentElement.clientWidth || document.body.offsetWidth;
        var $cur, $last;
        $cur = self.$el;
        $last = Backbone.stage.getLastView().$el;
        $cur.animate({left: fullWidth}, 140);
        $last.animate({scale: 1}, 140);
        setTimeout(function () {
          $cur.attr('style', null);
          $last.removeClass('stage-animate-show-behind').addClass('stage-animate-out').attr('style', null);
          self['action-back']([]);
        }, 140);
      },
      'edgeRightMove': function (e, touch) {
        var self = this;
        setTimeout(function () {
          var fullWidth = document.documentElement.clientWidth || document.body.offsetWidth;
          var max = fullWidth;
          var scale = touch.x2 / fullWidth * 0.1 + 0.9;
          self.$el.animate({left: touch.x2 > max ? max : touch.x2}, 0);
          Backbone.stage.getLastView().$el.animate({scale: scale}, 0);
        }, 0);
      },
      'edgeRightStart': function (e, touch) {
        Backbone.stage.getLastView().$el.removeClass('stage-animate-out').addClass('stage-animate-show-behind');
      },
      'edgeCancel': function () {
        var self = this;
        var $cur, $last;
        $cur = self.$el;
        $last = Backbone.stage.getLastView().$el;
        $cur.animate({left: 0}, 100);
        $last.animate({scale: 1}, 100);
        setTimeout(function () {
          $cur.attr('style', null);
          $last.removeClass('stage-animate-show-behind').addClass('stage-animate-out').attr('style', null);
        }, 100);
      },
      'swipeRight': 'prevPage',
      'swipeLeft': 'nextPage',
    },
    'action-back': function (transitions) {
      transitions = transitions instanceof Array ? transitions : ['slide-left', 'slide-right'];
      if (this.flag.active) {
        this.flag.active === false;
        Backbone.stage.back(transitions);
      }
    },
    _refreshScroll: function () {
      this.$el.find('.action-pulldown, .action-pullup').removeClass('loading');
      this.scroll.refresh();
    },
    refresh: function () {
      var tid, page;
      tid = this.collection.cache.tid;
      page = parseInt(this.collection.cache.page, 0);
      if (page) {
        this.fetch({tid: tid, page: page});
      } else {
        Backbone.stage.change('#!/topic/' + tid, [], {replace: true});
      }
    },
    prevPage: function () {
      var tid, page;
      if (this.collection.cache.page <= 1) {
        this._refreshScroll();
        Notification.alert('已经是第一页');
        return false;
      }
      tid = this.collection.cache.tid;
      page = parseInt(this.collection.cache.page, 0) - 1;
      Backbone.stage.change('#!/topic/' + tid + '/p' + page, [], {replace: true});
    },
    nextPage: function () {
      var tid, page;
      if (this.collection.cache.pageCount <= this.collection.cache.page) {
        this._refreshScroll();
        Notification.alert('已经到了最后一页');
        this.refresh();
        return false;
      }
      tid = this.collection.cache.tid;
      page = parseInt(this.collection.cache.page, 0) + 1;
      Backbone.stage.change('#!/topic/' + tid + '/p' + page, [], {replace: true});
    },
    render: function () {
      this.$el.html(this.tpl());
      this.$ul = this.$el.find('ul');
      this.$subject = this.$el.find('header span.subject');
      this.$footer = this.$el.find('footer');
      this.initializeScroll();
      return this;
    },
    /**
     * 创建滚动条
     */
    initializeScroll: function () {
      var self = this;
      var pullDownAction, pullUpAction;
      self.$el.find('.iscroll').css('height', window.innerHeight - 50);
      pullDownAction = function () {
        self.prevPage();
      };
      pullUpAction = function () {
        self.nextPage();
      };
      iScrollPull.call(self, 'topic-article', pullDownAction, pullUpAction);
      return self;
    },
    /**
     * 渲染单层楼视图
     * @private
     * @param {TopicModel} post
     */
    _addOne: function (post) {
      var view = new RowTopicView({model: post});
      this.$ul.append(view.el);
      $(view.el).addClass('animate');
      setTimeout(function () {
        $(view.el).removeClass('animate');
      }, 800);
    },
    /**
     * 添加全部楼层
     */
    _addAll: function () {
      var self = this;
      var flashDelegate;
      this._refreshScroll();
      this.$ul.html('');
      this.scroll.scrollTo(0, 0, 0);
      console.log(this.collection);
      this.collection.each(this._addOne, this);
      this.$subject.text(sliceSubject(this.collection.cache.subject));
      this.$el.find('header > div > a > sup').text(this.collection.cache.page);
      this.$el.find('header > div > a > sub').text(this.collection.cache.pageCount);
      // 图片加载后修正滚动条高度
      this.$ul.find('img').preloadSrc(function () {
        self.scroll.refresh();
      });
      // 加载视频
      flashDelegate = function () {
        var $container = $(this);
        var $control = $container.find('.ubb-flash-control');
        var $video = $container.find('video');
        var video = $video.get(0);
        $container.addClass('show');
        $video.on('play', function () {
          $control.hide();
        });
        $video.on('pause', function () {
          $control.show();
          $video.css('display', 'none');
        });
        $video.on('singleTap', function () {
          video.pause();
        });
        $control.on('singleTap', function () {
          $video.css('display', 'block');
          video.play();
        });
        self.scroll.refresh();
      };
      this.$ul.find('.ubb-flash').youku(flashDelegate).tudou(flashDelegate);
      _.delay(function () {
        ui.Loading.close();
      }, 600);
      _.delay(function () {
        self.scroll.refresh();
      }, 1000);
    },
    /**
     * 清空列表
     */
    _clearAll: function (model, resp, options) {
      var self = this;
      this._refreshScroll();
      this.$ul.html('');
      this.scroll.scrollTo(0, 0, 0);
      this.$subject.text('');
      _.delay(function () {
        ui.Loading.close();
      }, 600);
      _.delay(function () {
        self.scroll.refresh();
      }, 1000);
    },
    fetch: function (data, options) {
      ui.Loading.open();
      this.flag.active = true;
      _.defaults(options || (options = {}), {
        error: function () {
          Notification.alert('呜~进入帖子失败~');
          ui.Loading.close();
          _.delay(function (){
            Backbone.stage.back(['slide-left', 'slide-right']);
          }, 600);
        }
      });
      this.xhr = this.collection.fetchXml(data, options);
    },
    initialize: function () {
      var self = this;
      var initializeScroll = function () {
        self.initializeScroll();
      };
      this.collection = new PostInTopicCollection();
      this.$ul = this.$el.find('ul');
      this.$subject = this.$el.find('header span.subject');
      this.$footer = this.$el.find('footer');
      this.listenTo(this.collection, 'sync', this._addAll);
      this.listenTo(this.collection, 'error', this._clearAll);
      this.listenTo($(window), 'resize', initializeScroll);
      this.listenTo($(document), 'throttledresize', initializeScroll);
      this.listenTo($(document), 'orientationchange', initializeScroll);
      return this.render();
    }
  });
  module.exports = TopicView;
});
