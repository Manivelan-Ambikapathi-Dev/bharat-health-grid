import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ROLE_HOME } from '../auth/roles.js';
import { useAuth } from '../auth/AuthContext.jsx';

function AccessDeniedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const home = user?.role ? ROLE_HOME[user.role] : '/login';

  return (
    <main className="access-page">
      <Result
        status="403"
        title="403"
        subTitle="You do not have permission to access this resource."
        extra={[
          <Button key="home" type="primary" onClick={() => navigate(home)}>
            Back to your dashboard
          </Button>,
          <Button key="logout" onClick={logout}>
            Logout
          </Button>,
        ]}
      />
    </main>
  );
}

export default AccessDeniedPage;
