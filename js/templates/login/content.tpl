    <form class="action-login">
      <input class="username" type="text" placeholder="用户名" value="<%= lastUser %>" required  x-webkit-speech lang="zh-CN"/>
      <input class="password" type="password" placeholder="密码" value="" required x-webkit-speech lang="zh-CN"/>
      <div class="email">
        <% if (byEmail) { %>
          <input id="checkbox-email" type="checkbox" checked>
          <% } else { %>
          <input id="checkbox-email" type="checkbox">
        <% } %>
        <label for="checkbox-email">邮箱登陆</label>
      </div>
      <button type="submit"><span class="glyphicon glyphicon-chevron-right"></span></button>
      <p><a class="action-register" data-url="http://account.178.com/?p=register">马上注册高端大气上档次的NGA账号</a></p>
    </form>
