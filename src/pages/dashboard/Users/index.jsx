// src/pages/User.js
import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout, Breadcrumb } from 'antd';

const { Content } = Layout;

const User = () => {
    const { name } = useParams();

    return (
        <Content style={{ margin: '16px', padding: 24, background: '#fff', minHeight: 360 }}>
            <Breadcrumb style={{ marginBottom: '16px' }}>
                <Breadcrumb.Item>Dashboard</Breadcrumb.Item>
                <Breadcrumb.Item>User</Breadcrumb.Item>
                <Breadcrumb.Item>{name}</Breadcrumb.Item>
            </Breadcrumb>

            <h2 className="text-dark">User: {name}</h2>
        </Content>
    );
};

export default User;
