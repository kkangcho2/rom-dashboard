// ═══════════════════════════════════════════════════════════════
// ─── SNS Automation API Routes ──────────────────────────────
// ─── 별도 모듈: server/sns-routes.cjs
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const db = require('./db.cjs');

// ── Seed default industry templates ──
const existingTemplates = db.prepare('SELECT COUNT(*) as cnt FROM sns_industry_templates').get();
if (existingTemplates.cnt === 0) {
  const seedTemplates = [
    // 미용실
    { industry: 'beauty_salon', template_type: 'content_planning', name: '미용실 콘텐츠 기획',
      prompt_content: '당신은 미용실 마케팅 전문가입니다.\n\n목표: 예약을 유도하는 콘텐츠 생성\n\n타겟: 20~40 여성\n\n조건:\n- 전후 비교 강조\n- 트렌디한 스타일\n- 짧고 강한 메시지\n\n출력: 10개 콘텐츠 아이디어', is_default: 1 },
    { industry: 'beauty_salon', template_type: 'customer_response', name: '미용실 고객응대',
      prompt_content: '당신은 미용실 상담 직원입니다.\n\n목표: 예약 유도\n\n조건:\n- 친근함\n- 빠른 예약 유도\n\n입력: {고객 문의}\n\n출력:\n1. 공감\n2. 예약 가능 시간 안내\n3. 예약 유도', is_default: 1 },
    // 병원
    { industry: 'hospital', template_type: 'content_planning', name: '병원 콘텐츠 기획',
      prompt_content: '당신은 병원 마케팅 전문가입니다.\n\n목표: 신뢰 기반 콘텐츠 생성\n\n조건:\n- 과장 금지\n- 정보 중심\n- 전후 효과 설명\n\n출력: 10개 콘텐츠 아이디어', is_default: 1 },
    { industry: 'hospital', template_type: 'customer_response', name: '병원 고객응대',
      prompt_content: '당신은 병원 상담 직원입니다.\n\n목표: 상담 예약 유도\n\n조건:\n- 신뢰감\n- 전문성\n- 부담 없는 상담 유도\n\n출력:\n1. 공감\n2. 정보 제공\n3. 상담 예약 안내', is_default: 1 },
    // 헬스/PT
    { industry: 'fitness', template_type: 'content_planning', name: '헬스/PT 콘텐츠 기획',
      prompt_content: '당신은 피트니스 마케팅 전문가입니다.\n\n목표: 운동 욕구 자극\n\n조건:\n- 변화 사례 강조\n- 동기 부여\n- 간단한 팁 포함\n\n출력: 콘텐츠 10개', is_default: 1 },
    { industry: 'fitness', template_type: 'customer_response', name: '헬스/PT 고객응대',
      prompt_content: '당신은 피트니스 센터 상담사입니다.\n\n목표: 체험 등록 유도\n\n조건:\n- 동기부여\n- 맞춤 프로그램 안내\n- 부담 없는 체험 유도\n\n출력:\n1. 공감\n2. 프로그램 안내\n3. 체험 등록 유도', is_default: 1 },
    // 카페/레스토랑
    { industry: 'restaurant', template_type: 'content_planning', name: '카페/레스토랑 콘텐츠 기획',
      prompt_content: '당신은 F&B 마케팅 전문가입니다.\n\n목표: 방문 유도 콘텐츠 생성\n\n조건:\n- 비주얼 강조\n- 시즌 메뉴 활용\n- 감성적 분위기\n\n출력: 10개 콘텐츠 아이디어', is_default: 1 },
    { industry: 'restaurant', template_type: 'customer_response', name: '카페/레스토랑 고객응대',
      prompt_content: '당신은 카페/레스토랑 상담 직원입니다.\n\n목표: 예약/방문 유도\n\n조건:\n- 친근하고 따뜻한 톤\n- 메뉴 추천\n- 예약 편의 제공\n\n출력:\n1. 환영 인사\n2. 메뉴/공간 안내\n3. 예약 유도', is_default: 1 },
    // 학원/교육
    { industry: 'education', template_type: 'content_planning', name: '학원/교육 콘텐츠 기획',
      prompt_content: '당신은 교육 마케팅 전문가입니다.\n\n목표: 수강 등록 유도 콘텐츠\n\n조건:\n- 성과/후기 강조\n- 커리큘럼 차별점\n- 학습 동기 자극\n\n출력: 10개 콘텐츠 아이디어', is_default: 1 },
    { industry: 'education', template_type: 'customer_response', name: '학원/교육 고객응대',
      prompt_content: '당신은 학원 상담 직원입니다.\n\n목표: 상담/체험수업 유도\n\n조건:\n- 전문성과 신뢰감\n- 맞춤 커리큘럼 안내\n- 부담 없는 체험 유도\n\n출력:\n1. 공감\n2. 프로그램 안내\n3. 체험 수업 유도', is_default: 1 },
  ];
  const insertTpl = db.prepare('INSERT INTO sns_industry_templates (industry, template_type, name, prompt_content, is_default) VALUES (?, ?, ?, ?, ?)');
  for (const t of seedTemplates) {
    insertTpl.run(t.industry, t.template_type, t.name, t.prompt_content, t.is_default);
  }
  console.log('[SNS] Seeded default industry templates');
}

// ── Content Plans CRUD ──

router.get('/content-plans', (req, res) => {
  const { industry, status } = req.query;
  let sql = 'SELECT * FROM sns_content_plans WHERE 1=1';
  const params = [];
  if (industry) { sql += ' AND industry = ?'; params.push(industry); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(...params));
});

router.post('/content-plans', (req, res) => {
  const { industry, title, description, content_type, target_platform, status, tags, scheduled_date } = req.body;
  if (!industry || !title) return res.status(400).json({ error: 'industry and title are required' });
  const result = db.prepare(
    'INSERT INTO sns_content_plans (industry, title, description, content_type, target_platform, status, tags, scheduled_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(industry, title, description || '', content_type || 'video', target_platform || 'instagram', status || 'idea', tags || '', scheduled_date || null);
  res.json({ id: Number(result.lastInsertRowid), success: true });
});

router.put('/content-plans/:id', (req, res) => {
  const { title, description, content_type, target_platform, status, tags, scheduled_date } = req.body;
  db.prepare(
    'UPDATE sns_content_plans SET title=COALESCE(?,title), description=COALESCE(?,description), content_type=COALESCE(?,content_type), target_platform=COALESCE(?,target_platform), status=COALESCE(?,status), tags=COALESCE(?,tags), scheduled_date=COALESCE(?,scheduled_date), updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(title, description, content_type, target_platform, status, tags, scheduled_date, req.params.id);
  res.json({ success: true });
});

router.delete('/content-plans/:id', (req, res) => {
  db.prepare('DELETE FROM sns_content_plans WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Scripts CRUD ──

router.get('/scripts', (req, res) => {
  const { industry, status } = req.query;
  let sql = 'SELECT s.*, cp.title as plan_title FROM sns_scripts s LEFT JOIN sns_content_plans cp ON s.content_plan_id = cp.id WHERE 1=1';
  const params = [];
  if (industry) { sql += ' AND s.industry = ?'; params.push(industry); }
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  sql += ' ORDER BY s.created_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(...params));
});

router.post('/scripts', (req, res) => {
  const { content_plan_id, industry, prompt_template, generated_script, title, hashtags, status } = req.body;
  if (!industry) return res.status(400).json({ error: 'industry is required' });
  const result = db.prepare(
    'INSERT INTO sns_scripts (content_plan_id, industry, prompt_template, generated_script, title, hashtags, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(content_plan_id || null, industry, prompt_template || '', generated_script || '', title || '', hashtags || '', status || 'draft');
  res.json({ id: Number(result.lastInsertRowid), success: true });
});

router.put('/scripts/:id', (req, res) => {
  const { generated_script, title, hashtags, status } = req.body;
  db.prepare(
    'UPDATE sns_scripts SET generated_script=COALESCE(?,generated_script), title=COALESCE(?,title), hashtags=COALESCE(?,hashtags), status=COALESCE(?,status), updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(generated_script, title, hashtags, status, req.params.id);
  res.json({ success: true });
});

router.delete('/scripts/:id', (req, res) => {
  db.prepare('DELETE FROM sns_scripts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Upload Schedules CRUD ──

router.get('/schedules', (req, res) => {
  const { platform, status } = req.query;
  let sql = 'SELECT us.*, sc.title as script_title FROM sns_upload_schedules us LEFT JOIN sns_scripts sc ON us.script_id = sc.id WHERE 1=1';
  const params = [];
  if (platform) { sql += ' AND us.platform = ?'; params.push(platform); }
  if (status) { sql += ' AND us.status = ?'; params.push(status); }
  sql += ' ORDER BY us.scheduled_at ASC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

router.post('/schedules', (req, res) => {
  const { script_id, platform, title, description, hashtags, scheduled_at, video_url } = req.body;
  if (!platform || !scheduled_at) return res.status(400).json({ error: 'platform and scheduled_at are required' });
  const result = db.prepare(
    'INSERT INTO sns_upload_schedules (script_id, platform, title, description, hashtags, scheduled_at, video_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(script_id || null, platform, title || '', description || '', hashtags || '', scheduled_at, video_url || '');
  res.json({ id: Number(result.lastInsertRowid), success: true });
});

router.put('/schedules/:id', (req, res) => {
  const { status, post_url } = req.body;
  db.prepare(
    'UPDATE sns_upload_schedules SET status=COALESCE(?,status), post_url=COALESCE(?,post_url) WHERE id=?'
  ).run(status, post_url, req.params.id);
  res.json({ success: true });
});

router.delete('/schedules/:id', (req, res) => {
  db.prepare('DELETE FROM sns_upload_schedules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Auto Responses CRUD ──

router.get('/auto-responses', (req, res) => {
  const { industry, trigger_type } = req.query;
  let sql = 'SELECT * FROM sns_auto_responses WHERE 1=1';
  const params = [];
  if (industry) { sql += ' AND industry = ?'; params.push(industry); }
  if (trigger_type) { sql += ' AND trigger_type = ?'; params.push(trigger_type); }
  sql += ' ORDER BY use_count DESC, created_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(...params));
});

router.post('/auto-responses', (req, res) => {
  const { industry, trigger_type, trigger_keywords, response_template, platform, is_active } = req.body;
  if (!industry || !trigger_type || !response_template) return res.status(400).json({ error: 'industry, trigger_type, and response_template are required' });
  const result = db.prepare(
    'INSERT INTO sns_auto_responses (industry, trigger_type, trigger_keywords, response_template, platform, is_active) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(industry, trigger_type, trigger_keywords || '', response_template, platform || 'all', is_active !== undefined ? is_active : 1);
  res.json({ id: Number(result.lastInsertRowid), success: true });
});

router.put('/auto-responses/:id', (req, res) => {
  const { trigger_keywords, response_template, is_active } = req.body;
  db.prepare(
    'UPDATE sns_auto_responses SET trigger_keywords=COALESCE(?,trigger_keywords), response_template=COALESCE(?,response_template), is_active=COALESCE(?,is_active), updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(trigger_keywords, response_template, is_active, req.params.id);
  res.json({ success: true });
});

router.delete('/auto-responses/:id', (req, res) => {
  db.prepare('DELETE FROM sns_auto_responses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Leads CRUD ──

router.get('/leads', (req, res) => {
  const { status, platform } = req.query;
  let sql = 'SELECT * FROM sns_leads WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (platform) { sql += ' AND platform = ?'; params.push(platform); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

router.post('/leads', (req, res) => {
  const { name, contact, platform, source, inquiry_type, message, status } = req.body;
  const result = db.prepare(
    'INSERT INTO sns_leads (name, contact, platform, source, inquiry_type, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name || '', contact || '', platform || '', source || '', inquiry_type || '', message || '', status || 'new');
  res.json({ id: Number(result.lastInsertRowid), success: true });
});

router.put('/leads/:id', (req, res) => {
  const { status, assigned_to, notes, converted_at } = req.body;
  db.prepare(
    'UPDATE sns_leads SET status=COALESCE(?,status), assigned_to=COALESCE(?,assigned_to), notes=COALESCE(?,notes), converted_at=COALESCE(?,converted_at), updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(status, assigned_to, notes, converted_at, req.params.id);
  res.json({ success: true });
});

router.delete('/leads/:id', (req, res) => {
  db.prepare('DELETE FROM sns_leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Industry Templates ──

router.get('/templates', (req, res) => {
  const { industry, template_type } = req.query;
  let sql = 'SELECT * FROM sns_industry_templates WHERE 1=1';
  const params = [];
  if (industry) { sql += ' AND industry = ?'; params.push(industry); }
  if (template_type) { sql += ' AND template_type = ?'; params.push(template_type); }
  sql += ' ORDER BY is_default DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/templates', (req, res) => {
  const { industry, template_type, name, prompt_content, variables } = req.body;
  if (!industry || !template_type || !name || !prompt_content) return res.status(400).json({ error: 'industry, template_type, name, and prompt_content are required' });
  const result = db.prepare(
    'INSERT INTO sns_industry_templates (industry, template_type, name, prompt_content, variables) VALUES (?, ?, ?, ?, ?)'
  ).run(industry, template_type, name, prompt_content, variables || '');
  res.json({ id: Number(result.lastInsertRowid), success: true });
});

// ── SNS Dashboard Stats ──

router.get('/stats', (req, res) => {
  const plans = db.prepare('SELECT COUNT(*) as cnt FROM sns_content_plans').get().cnt;
  const scripts = db.prepare('SELECT COUNT(*) as cnt FROM sns_scripts').get().cnt;
  const schedules = db.prepare('SELECT COUNT(*) as cnt FROM sns_upload_schedules').get().cnt;
  const scheduledPending = db.prepare("SELECT COUNT(*) as cnt FROM sns_upload_schedules WHERE status = 'scheduled'").get().cnt;
  const responses = db.prepare('SELECT COUNT(*) as cnt FROM sns_auto_responses WHERE is_active = 1').get().cnt;
  const leads = db.prepare('SELECT COUNT(*) as cnt FROM sns_leads').get().cnt;
  const newLeads = db.prepare("SELECT COUNT(*) as cnt FROM sns_leads WHERE status = 'new'").get().cnt;
  const converted = db.prepare("SELECT COUNT(*) as cnt FROM sns_leads WHERE status = 'converted'").get().cnt;
  const plansByStatus = db.prepare('SELECT status, COUNT(*) as cnt FROM sns_content_plans GROUP BY status').all();
  const leadsByPlatform = db.prepare('SELECT platform, COUNT(*) as cnt FROM sns_leads WHERE platform != "" GROUP BY platform').all();

  res.json({
    totalPlans: plans,
    totalScripts: scripts,
    totalSchedules: schedules,
    scheduledPending,
    activeResponses: responses,
    totalLeads: leads,
    newLeads,
    convertedLeads: converted,
    conversionRate: leads > 0 ? Math.round(converted / leads * 100) : 0,
    plansByStatus,
    leadsByPlatform,
  });
});

module.exports = router;
