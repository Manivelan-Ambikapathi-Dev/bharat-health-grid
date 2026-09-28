import { Layout, Typography } from 'antd';
import './HomePage.css';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph } = Typography;

function HomePage() {
  return (
    <Layout className="home-layout">
      <Header className="home-header">
        <span className="home-mark">BHG</span>
        <span className="home-brand">Bharat Health Grid</span>
      </Header>
      <Content className="home-content">
        <section className="home-hero">
          <Title className="home-title">Bharat Health Grid</Title>
          <Paragraph className="home-tagline">
            AI-Powered Federated Health Resource Intelligence for India
          </Paragraph>
        </section>
      </Content>
      <Footer className="home-footer">
        Healthcare resource intelligence for India&apos;s Primary Health Centre network
      </Footer>
    </Layout>
  );
}

export default HomePage;
