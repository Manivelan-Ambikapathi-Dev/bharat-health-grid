import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import BrandLogo from '../components/BrandLogo.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_HOME } from '../auth/roles.js';
import './LoginPage.css';

function LoginPage() {
  const { ready, isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!ready) {
    return null;
  }

  if (isAuthenticated && user?.role && ROLE_HOME[user.role]) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  async function onFinish(values) {
    setSubmitting(true);
    setError('');
    try {
      const nextUser = await login(values.username.trim(), values.password);
      navigate(ROLE_HOME[nextUser.role] || '/login', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Platform introduction">
        <img
          className="login-hero-image"
          src="/images/bhg-login-hero.png"
          alt="A doctor and a nurse in a modern Indian primary health centre"
        />
        <div className="login-hero-shade" />
        <div className="login-hero-copy">
          <p className="login-badge"><span className="login-badge-dot" aria-hidden="true" /> National health intelligence platform</p>
          <h1>Connecting India&apos;s healthcare resources with intelligence.</h1>
          <p>From national visibility to PHC-level action.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-panel-inner">
          <BrandLogo variant="dark" />
          <p className="login-tagline">AI-Powered Federated Health Resource Intelligence for India</p>
          <h2>Welcome back</h2>
          <p className="login-access">Access Bharat Health Grid</p>
          <p className="login-support">Sign in to access health resource intelligence for your authorized scope.</p>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false} className="login-form">
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: 'Enter your username' }]}
            >
              <Input
                autoComplete="username"
                size="large"
                prefix={<UserOutlined aria-hidden />}
                aria-label="Username"
              />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Enter your password' }]}
            >
              <Input.Password
                autoComplete="current-password"
                size="large"
                prefix={<LockOutlined aria-hidden />}
                aria-label="Password"
                visibilityToggle
              />
            </Form.Item>
            {error ? <Alert type="error" showIcon title={error} className="login-error" /> : null}
            <Button type="primary" htmlType="submit" size="large" block loading={submitting} className="login-submit">
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
