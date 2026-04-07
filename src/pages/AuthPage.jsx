import { useState } from 'react';
import LoginLayout from '../layouts/LoginLayout';

function EntryCard({ title, detail, onClick }) {
  return (
    <button type="button" className="entry-card" onClick={onClick}>
      <span className="entry-card-label">{title}</span>
      <span className="entry-card-text">{detail}</span>
    </button>
  );
}

export default function AuthPage({ navigate }) {
  const [mode, setMode] = useState('login');

  return (
    <LoginLayout
      aside={(
        <div className="auth-hero-copy">
          <p className="layout-eyebrow">Lianjue Learning Platform</p>
          <h1 className="layout-title auth-title">前端静态交互稿</h1>
          <p className="layout-subtitle">
            当前版本仅对齐你在 2026 年 4 月 6 日备忘里定义的三类页面：
            登录/注册、教师 dashboard、学生 dashboard。
          </p>
          <div className="auth-hero-grid">
            <article className="auth-highlight">
              <span className="auth-highlight-label">Teacher</span>
              <strong>围绕教学大纲、习题构建、材料一览做固定网格交互。</strong>
            </article>
            <article className="auth-highlight">
              <span className="auth-highlight-label">Student</span>
              <strong>围绕 personal_syllabus、提问推荐、学习记录做学习侧交互。</strong>
            </article>
          </div>
        </div>
      )}
    >
      <section className="auth-card">
        <header className="auth-card-head">
          <p className="layout-eyebrow">{mode === 'login' ? 'Sign In' : 'Sign Up'}</p>
          <h2>{mode === 'login' ? '进入平台' : '创建账号'}</h2>
          <p>
            不接真实鉴权。此页只保留备忘要求的登录/注册入口与角色跳转，
            便于直接检查教师端与学生端页面。
          </p>
        </header>

        <div className="auth-actions">
          <button
            type="button"
            className={`button ${mode === 'login' ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`button ${mode === 'register' ? 'button-primary' : 'button-secondary'}`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        <form className="auth-form">
          <label className="field">
            <span>{mode === 'login' ? '账号' : '邮箱'}</span>
            <input placeholder={mode === 'login' ? '输入账号' : '输入邮箱'} />
          </label>
          <label className="field">
            <span>密码</span>
            <input type="password" placeholder="输入密码" />
          </label>
          {mode === 'register' ? (
            <label className="field">
              <span>确认密码</span>
              <input type="password" placeholder="再次输入密码" />
            </label>
          ) : null}
        </form>

        <div className="auth-entry-grid">
          <EntryCard
            title="教师端"
            detail="进入教学大纲构建、习题草稿/终稿编辑、材料一览。"
            onClick={() => navigate('/teacher')}
          />
          <EntryCard
            title="学生端"
            detail="进入学习大纲、提问区、推荐材料区与学习记录。"
            onClick={() => navigate('/student')}
          />
        </div>
      </section>
    </LoginLayout>
  );
}
