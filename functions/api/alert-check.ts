export async function onRequestGet(context: any) {
  const { env, request } = context;
  
  // 定义统一的 JSON 响应函数，防止 HTML 污染
  const makeResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  };

  try {
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('user_id');
    const now = Date.now();
    const ALERT_THRESHOLD = 2 * 60 * 1000; 

    // 检查环境变量
    const RESEND_API_KEY = env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return makeResponse({ status: "error", message: "未在 Cloudflare 中配置 RESEND_API_KEY 环境变量" }, 500);
    }

    // 检查数据库绑定
    if (!env.DB) {
      return makeResponse({ status: "error", message: "Cloudflare D1 数据库绑定 'DB' 未找到，请检查控制台设置" }, 500);
    }

    let usersToAlert = [];

    if (targetUserId) {
      // 模式 A: 针对特定用户核对数据
      const query = await env.DB.prepare(`
        SELECT u.id as user_id, u.name as user_name, u.language, c.email as contact_email, u.last_check_in
        FROM users u
        LEFT JOIN contacts c ON u.id = c.user_id
        WHERE u.id = ?
      `).bind(targetUserId).all();
      usersToAlert = query.results || [];
    } else {
      // 模式 B: 自动巡检全库
      const query = await env.DB.prepare(`
        SELECT u.id as user_id, u.name as user_name, u.last_check_in, u.language, c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.is_registered = 1 AND u.last_check_in < ?
        ORDER BY u.last_check_in DESC LIMIT 5
      `).bind(now - ALERT_THRESHOLD).all();
      usersToAlert = query.results || [];
    }

    if (usersToAlert.length === 0) {
      return makeResponse({ 
        status: "success", 
        message: targetUserId ? "未在云端数据库找到该 ID 的记录，请检查同步是否成功。" : "目前没有失联用户", 
        report: [] 
      });
    }

    const report = [];

    for (const user of usersToAlert) {
      if (!user.contact_email) {
        report.push({ 
          user_id: user.user_id, 
          user_name: user.user_name,
          success: false, 
          message: "该用户在云端存在，但关联的联系人邮箱为空。原因可能是 ID 冲突导致联系人表写入失败。" 
        });
        continue;
      }

      const isEn = user.language === 'en';
      const subject = isEn ? `[Safety Alert Test] ${user.user_name}` : `【安全预警测试】请确认${user.user_name}的状态`;
      const textBody = `您好，这是来自“活着么”App的预警系统测试。
用户姓名：${user.user_name}
用户 ID：${user.user_id}
当前云端邮箱：${user.contact_email}

如果您收到此邮件，说明云端预警触发流程已通。`;

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Live Well <onboarding@resend.dev>",
            to: [user.contact_email],
            subject: subject,
            text: textBody,
          }),
        });

        const resendData: any = await resendResponse.json();
        report.push({
          user_id: user.user_id,
          user_name: user.user_name,
          cloud_email: user.contact_email,
          success: resendResponse.ok,
          debug: resendData
        });
      } catch (sendErr: any) {
        report.push({
          user_id: user.user_id,
          success: false,
          message: "发送邮件请求发生网络错误: " + sendErr.message
        });
      }
    }

    return makeResponse({ 
      status: "success", 
      mode: targetUserId ? "Targeted" : "Scan",
      report 
    });

  } catch (err: any) {
    // 捕获所有代码运行异常，确保返回 JSON
    return makeResponse({ 
      status: "error", 
      message: "API 脚本运行异常: " + err.message,
      stack: err.stack
    }, 500);
  }
}
