// src/layouts/Sidebar.js
import React from 'react';
import { Layout, Menu, Badge, Tooltip, theme, Typography, Grid } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  MessageOutlined,
  TeamOutlined,
  BarChartOutlined,
  FireOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const { Sider } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

const Sidebar = ({ collapsed, onClose }) => {
  const { user } = useAuth();
  const { settings } = useSettings(); // settings from context, e.g. settings.petrolPrice

  const role = user?.role || 'guest';
  const location = useLocation();
  const screens = useBreakpoint();
  const { token } = theme.useToken();

  console.log('settings', settings)
  // Determine active menu item based on URL
  const getSelectedKeys = () => {
    const path = location.pathname.split('/').filter(Boolean);
    if (path.length > 1) {
      if (path[1] === 'reports' && path.length > 2) {
        return [path[2] + '-report'];
      }
      return [path[1]];
    }
    return ['dashboard'];
  };

  // Common items available to all roles
  const commonItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined style={{ fontSize: '18px' }} />,
      label: <Link to="/dashboard">Dashboard</Link>
    }
  ];

  // Role-specific menu items
  const roleMenuItems = {
    admin: [
      {
        key: 'accounts',
        icon: <DollarOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/accounts">Accounts</Link>
      },
      {
        key: 'nozel-sales',
        icon: <FireOutlined style={{ fontSize: '18px', color: token.colorPrimary }} />,
        label: (
          <Badge count={5} offset={[10, 0]} style={{ backgroundColor: token.colorError }}>
            <Link to="/dashboard/nozel-sales">Nozel Sales</Link>
          </Badge>
        )
      },
      {
        key: 'purchase',
        icon: <ShoppingCartOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/purchase">Purchase</Link>
      },
      {
        key: 'inventory',
        icon: <AppstoreOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/inventory">Inventory</Link>
      },
      {
        key: 'payroll',
        icon: <FileTextOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/payroll">Payroll</Link>
      },
      {
        key: 'sms',
        icon: <MessageOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/sms">SMS Integration</Link>
      },
      {
        key: 'reports',
        icon: <BarChartOutlined style={{ fontSize: '18px' }} />,
        label: 'Reports',
        children: [
          { key: 'daily-report', label: <Link to="/dashboard/reports/daily">Daily Report</Link> },
          {
            key: 'credit-report',
            label: (
              <Badge dot color={token.colorSuccess}>
                <Link to="/dashboard/reports/credit">Credit Management</Link>
              </Badge>
            )
          }
        ]
      },
      {
        key: 'user-roles',
        icon: <TeamOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/user-roles">User Roles</Link>
      }
    ],
    manager: [
      {
        key: 'accounts',
        icon: <DollarOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/accounts">Accounts</Link>
      },
      {
        key: 'nozel-sales',
        icon: <FireOutlined style={{ fontSize: '18px', color: token.colorPrimary }} />,
        label: <Link to="/dashboard/nozel-sales">Nozel Sales</Link>
      },
      {
        key: 'purchase',
        icon: <ShoppingCartOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/purchase">Purchase</Link>
      },
      {
        key: 'inventory',
        icon: <AppstoreOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/inventory">Inventory</Link>
      },
      {
        key: 'payroll',
        icon: <FileTextOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/payroll">Payroll</Link>
      },
      {
        key: 'reports',
        icon: <BarChartOutlined style={{ fontSize: '18px' }} />,
        label: 'Reports',
        children: [
          { key: 'daily-report', label: <Link to="/dashboard/reports/daily">Daily Report</Link> },
          { key: 'credit-report', label: <Link to="/dashboard/reports/credit">Credit Management</Link> }
        ]
      }
    ],
    seller: [
      {
        key: 'nozel-sales',
        icon: <FireOutlined style={{ fontSize: '18px', color: token.colorPrimary }} />,
        label: <Link to="/dashboard/nozel-sales">Nozel Sales</Link>
      },
      {
        key: 'purchase',
        icon: <ShoppingCartOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/purchase">Purchase</Link>
      },
      {
        key: 'inventory',
        icon: <AppstoreOutlined style={{ fontSize: '18px' }} />,
        label: <Link to="/dashboard/inventory">Inventory</Link>
      },
      {
        key: 'reports',
        icon: <BarChartOutlined style={{ fontSize: '18px' }} />,
        label: 'Reports',
        children: [{ key: 'daily-report', label: <Link to="/dashboard/reports/daily">Daily Report</Link> }]
      }
    ]
  };

  // Merge common items with role-specific items
  const menuItems = [...commonItems, ...(roleMenuItems[role] || [])];

  // Handle menu item click: trigger onClose only on small screens
  const handleMenuClick = () => {
    if (!screens.lg && onClose) {
      onClose();
    }
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onClose}
      breakpoint="lg"
      collapsedWidth={80}
      width={260}
      style={{
        minHeight: '100vh',
        boxShadow: '2px 0 8px 0 rgba(29,35,41,0.05)',
        zIndex: 10,
        position: 'sticky',
        top: 0,
        left: 0,
        background: token.colorBgContainer,
        transition: 'all 0.2s'
      }}
      theme="light"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Logo Section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '70px',
            padding: '16px',
            margin: '10px 0',
            overflow: 'hidden',
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}
        >
          {collapsed ? (
            <Tooltip title={settings?.name} placement="right">
              <div
                className="d-flex justify-content-center align-items-center w-100 object-fit-cover"
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <img
                  src={settings?.collapsedLogoUrl}
                  alt={settings?.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </div>
            </Tooltip>
          ) : (
            <div className="d-flex justify-content-center align-items-center w-100 object-fit-cover">
              <img
                src={settings?.logoUrl}
                alt={settings?.name}
                className="img-fluid object-fit-contain"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </div>
          )}


        </div>

        {/* Logged in user info */}
        {!collapsed && (
          <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>LOGGED IN AS</Text>
            <div style={{ fontWeight: 'bold', color: token.colorText }}>{user?.role || 'Guest'}</div>
          </div>
        )}

        {/* Menu Items */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            borderRight: collapsed ? 'none' : `1px solid ${token.colorBorderSecondary}`
          }}
        >
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={getSelectedKeys()}
            defaultOpenKeys={collapsed ? [] : ['reports']}
            items={menuItems}
            style={{
              borderRight: 0,
              fontWeight: '500'
            }}
            onClick={handleMenuClick}
          />
        </div>

        {/* Petrol Pricing Footer - Always fixed at the bottom */}
        <div
          style={{
            position: 'sticky',
            bottom: "30px",
            left: 0,
            width: '100%',
            padding: '16px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            textAlign: 'center',
            background: token.colorBgContainer
          }}
        >
          <Text strong style={{ fontSize: '14px' }}>Petrol Price</Text>
          <br />
          <Text type="danger" style={{ fontSize: '18px' }}>
            {settings && settings.petrolPrice ? `$${settings.petrolPrice} / Liter` : '$1.20 / Liter'}
          </Text>
        </div>
      </div>
    </Sider>
  );
};

export default Sidebar;
