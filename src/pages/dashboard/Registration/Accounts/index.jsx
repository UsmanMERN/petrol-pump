import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space,
    Card, Typography, message, Tooltip, Popconfirm, InputNumber
} from 'antd';
import {
    UserAddOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, SearchOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';

const { Title } = Typography;
const { Option } = Select;

const AccountManagement = () => {
    const [accounts, setAccounts] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    useEffect(() => {
        fetchAccounts();

        // Update date and time every minute
        const dateTimeInterval = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 60000);

        return () => clearInterval(dateTimeInterval);
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "accounts"));
            const accountList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
            setAccounts(accountList);
        } catch (error) {
            message.error("Failed to fetch accounts: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue(record);
        } else {
            setEditingId(null);
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleSubmit = async (values) => {
        try {
            const timestamp = new Date().toISOString();
            if (editingId) {
                await updateDoc(doc(db, "accounts", editingId), {
                    ...values,
                    updatedAt: timestamp
                });
                message.success("Account updated successfully");
            } else {
                await addDoc(collection(db, "accounts"), {
                    ...values,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
                message.success("Account created successfully");
            }
            setIsModalVisible(false);
            fetchAccounts();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "accounts", id));
            message.success("Account deleted successfully");
            fetchAccounts();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        }
    };

    const handleExportToExcel = () => {
        exportToExcel(accounts, 'Accounts');
        message.success("Exported successfully");
    };

    const columns = [
        {
            title: 'Account ID',
            dataIndex: 'accountId',
            key: 'accountId',
            sorter: (a, b) => a.accountId.localeCompare(b.accountId),
        },
        {
            title: 'Name',
            dataIndex: 'accountName',
            key: 'accountName',
            sorter: (a, b) => a.accountName.localeCompare(b.accountName),
        },
        {
            title: 'Account Type',
            dataIndex: 'accountType',
            key: 'accountType',
            filters: [
                { text: 'Assets', value: 'assets' },
                { text: 'Customer', value: 'customer' },
                { text: 'Supplier', value: 'supplier' },
                { text: 'Staff', value: 'staff' },
                { text: 'Bank', value: 'bank' },
                { text: 'Expense', value: 'expense' },
                { text: 'Partner', value: 'partner' },
            ],
            onFilter: (value, record) => record.accountType === value,
        },
        {
            title: 'City',
            dataIndex: 'city',
            key: 'city',
        },
        {
            title: 'Phone',
            dataIndex: 'phoneNumber',
            key: 'phoneNumber',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <span style={{ color: status === 'active' ? '#52c41a' : '#f5222d' }}>
                    {status?.charAt(0).toUpperCase() + status?.slice(1)}
                </span>
            ),
            filters: [
                { text: 'Active', value: 'active' },
                { text: 'Inactive', value: 'inactive' },
            ],
            onFilter: (value, record) => record.status === value,
        },
        {
            title: 'Created Date',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleDateString(),
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            responsive: ['md'],
        },
        {
            title: 'Updated Date',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (date) => new Date(date).toLocaleDateString(),
            sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
            responsive: ['lg'],
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Edit">
                        <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={() => showModal(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this account?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const filteredAccounts = accounts.filter(account =>
        account.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Card className="account-management-container">
            <div className="account-header d-flex justify-content-between flex-wrap mb-3">
                <div>
                    <Title level={3}>Account Management</Title>
                </div>
                <Space wrap style={{ marginTop: '10px' }}>
                    <Input
                        placeholder="Search by name or ID"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: 300 }}
                        prefix={<SearchOutlined />}
                    />
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => showModal()}
                    >
                        Add Account
                    </Button>
                    <Button
                        type="default"
                        icon={<FileExcelOutlined />}
                        onClick={handleExportToExcel}
                    >
                        Export to Excel
                    </Button>
                </Space>
            </div>

            <div className="table-responsive">
                <Table
                    columns={columns}
                    dataSource={filteredAccounts}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, responsive: true }}
                    bordered
                    scroll={{ x: 'max-content' }}
                />
            </div>

            <Modal
                title={editingId ? "Edit Account" : "Add New Account"}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                width={800}
                style={{ maxWidth: '95vw' }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '16px'
                    }}>
                        <Form.Item
                            name="accountId"
                            label="Account ID"
                            rules={[{ required: true, message: 'Please enter account ID' }]}
                        >
                            <Input placeholder="Enter account ID" />
                        </Form.Item>

                        <Form.Item
                            name="accountName"
                            label="Account Name"
                            rules={[{ required: true, message: 'Please enter account name' }]}
                        >
                            <Input placeholder="Enter account name" />
                        </Form.Item>

                        <Form.Item
                            name="address"
                            label="Address"
                            rules={[{ required: true, message: 'Please enter address' }]}
                        >
                            <Input.TextArea placeholder="Enter address" />
                        </Form.Item>

                        <Form.Item
                            name="city"
                            label="City"
                            rules={[{ required: true, message: 'Please enter city' }]}
                        >
                            <Input placeholder="Enter city" />
                        </Form.Item>

                        <Form.Item
                            name="phoneNumber"
                            label="Phone Number"
                            rules={[{ required: true, message: 'Please enter phone number' }]}
                        >
                            <Input placeholder="Enter phone number" />
                        </Form.Item>

                        <Form.Item
                            name="email"
                            label="Email Address"
                            rules={[
                                { required: true, message: 'Please enter email address' },
                                { type: 'email', message: 'Invalid email format' }
                            ]}
                        >
                            <Input placeholder="Enter email address" />
                        </Form.Item>

                        <Form.Item
                            name="openDebit"
                            label="Opening Debit (PKR)"
                            rules={[{ required: true, message: 'Please enter opening debit' }]}
                        >
                            <InputNumber
                                min={0}
                                step={0.01}
                                style={{ width: '100%' }}
                                placeholder="0.00"
                                formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/₨\s?|(,*)/g, '')}
                            />
                        </Form.Item>

                        <Form.Item
                            name="openCredit"
                            label="Opening Credit (PKR)"
                            rules={[{ required: true, message: 'Please enter opening credit' }]}
                        >
                            <InputNumber
                                min={0}
                                step={0.01}
                                style={{ width: '100%' }}
                                placeholder="0.00"
                                formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/₨\s?|(,*)/g, '')}
                            />
                        </Form.Item>

                        <Form.Item
                            name="accountType"
                            label="Account Type"
                            rules={[{ required: true, message: 'Please select account type' }]}
                        >
                            <Select placeholder="Select account type">
                                <Option value="assets">Assets</Option>
                                <Option value="customer">Customer</Option>
                                <Option value="supplier">Supplier</Option>
                                <Option value="staff">Staff</Option>
                                <Option value="bank">Bank</Option>
                                <Option value="expense">Expense</Option>
                                <Option value="partner">Partner</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="status"
                            label="Status"
                            rules={[{ required: true, message: 'Please select status' }]}
                        >
                            <Select placeholder="Select status">
                                <Option value="active">Active</Option>
                                <Option value="inactive">Inactive</Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                {editingId ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default AccountManagement;