// src/layouts/DashboardLayout.js
import React, { useState, useEffect } from 'react';
import { Layout, Button, Drawer, Typography, Avatar, Dropdown, Space, theme, Badge, Card, Row, Col } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  BellOutlined,
  UserOutlined,
  CalendarOutlined,
  SettingOutlined,
  LogoutOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import Sidebar from './Sidebar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import dayjs from 'dayjs';
import 'bootstrap/dist/css/bootstrap.min.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const DashboardLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { token } = theme.useToken();

  // Update current date every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(dayjs());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setMobileView(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setDrawerVisible(false);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update page title based on current route
  useEffect(() => {
    const path = location.pathname.split('/').filter(Boolean);
    if (path.length > 1) {
      if (path[1] === 'reports' && path.length > 2) {
        const reportType = path[2].charAt(0).toUpperCase() + path[2].slice(1).replace(/-/g, ' ');
        setPageTitle(`${reportType} Report`);
      } else {
        const title = path[1].charAt(0).toUpperCase() + path[1].slice(1).replace(/-/g, ' ');
        setPageTitle(title);
      }
    } else {
      setPageTitle('Dashboard');
    }
  }, [location]);

  const handleMenuClick = (e) => {
    if (e.key === 'logout') {
      logout();
      navigate('/login');
    } else if (e.key === 'profile') {
      navigate('/dashboard/profile');
    } else if (e.key === 'settings') {
      navigate('/dashboard/settings');
    }
  };

  const userMenuItems = [
    // {
    //   key: 'profile',
    //   label: 'Profile',
    //   icon: <ProfileOutlined />,
    // },
    ...(user?.role == 'admin'
      ? [
        {
          key: 'settings',
          label: 'Settings',
          icon: <SettingOutlined />,
        },
      ]
      : []),
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];


  // Format date in an elegant way
  const formattedDate = {
    day: currentDate.format('dddd'),
    date: currentDate.format('DD'),
    month: currentDate.format('MMMM'),
    year: currentDate.format('YYYY'),
    time: currentDate.format('hh:mm A')
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Show Sidebar for desktop and Drawer for mobile */}
      {mobileView ? (
        <Drawer
          placement="left"
          open={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          width={280}
          styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        >
          <Sidebar collapsed={false} onClose={() => setDrawerVisible(false)} />
        </Drawer>
      ) : (
        <Sidebar collapsed={collapsed} onClose={() => setCollapsed(!collapsed)} />
      )}

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            width: '100%',
            height: '70px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={mobileView ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
              onClick={() => mobileView ? setDrawerVisible(true) : setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 48, height: 48, marginRight: 16 }}
              className="d-flex align-items-center justify-content-center"
            />
            <div className="d-flex flex-column">
              <Title level={4} style={{ margin: 0, marginLeft: 0 }}>
                {pageTitle}
              </Title>
              {!mobileView && (
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                  <CalendarOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                  <Text type="secondary">
                    {formattedDate.day}, {formattedDate.month} {formattedDate.date}, {formattedDate.year} - {formattedDate.time}
                  </Text>
                </div>
              )}
            </div>
          </div>

          <div className='d-flex align-items-center gap-3'>
            <Badge count={3} size="small">
              <Button
                type="text"
                icon={<BellOutlined className='fs-4' />}
                className="d-flex align-items-center justify-content-center"
              />
            </Badge>

            <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} placement="bottomRight" trigger={['click']}>
              <div className="d-flex align-items-center gap-2" style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: token.borderRadius, transition: 'all 0.3s ease', '&:hover': { backgroundColor: token.colorBgTextHover } }}>
                <Avatar
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: token.colorPrimary,
                    marginRight: 12
                  }}
                  size={40}
                />
                {!mobileView && (
                  <div className="me-2 d-flex flex-column">
                    <Text strong style={{ fontSize: '14px' }}>{user?.name || 'User'}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>{user?.role || 'Guest'}</Text>
                  </div>
                )}
                <SettingOutlined style={{ fontSize: '14px', color: token.colorTextSecondary }} />
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{
          margin: '24px 16px',
          background: token.colorBgLayout,
          borderRadius: 0,
          minHeight: 280,
          overflow: 'initial'
        }}>
          <Card
            variant={false}
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
              minHeight: "85vh"
            }}
          >
            {/* <Outlet /> */}
            {children}
          </Card>

          {mobileView && (
            <Card className="mt-3" variant={false} style={{ borderRadius: token.borderRadiusLG }}>
              <Row align="middle" justify="center">
                <Col>
                  <Space direction="horizontal" align="center">
                    <CalendarOutlined style={{ color: token.colorPrimary }} />
                    <Text type="secondary">
                      {formattedDate.day}, {formattedDate.month} {formattedDate.date}, {formattedDate.year}
                    </Text>
                  </Space>
                </Col>
              </Row>
            </Card>
          )}
        </Content>

        <Footer style={{
          textAlign: 'center',
          padding: '12px 50px',
          backgroundColor: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`
        }}>
          <Text type="secondary">Petrol Pump Management System ©{new Date().getFullYear()}</Text>
        </Footer>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;