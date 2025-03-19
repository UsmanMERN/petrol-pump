import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Space, Card,
    Typography, message, Tooltip, Popconfirm, Select, Badge
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, ApiOutlined, ToolOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';

const { Title } = Typography;
const { Option } = Select;

const DispenserManagement = () => {
    const [dispensers, setDispensers] = useState([]);
    const [nozzles, setNozzles] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDispensers();
        fetchNozzles();
    }, []);

    const fetchDispensers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "dispensers"));
            const dispenserList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDispensers(dispenserList);
        } catch (error) {
            message.error("Failed to fetch dispensers: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchNozzles = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "nozzles"));
            const nozzleList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setNozzles(nozzleList);
        } catch (error) {
            message.error("Failed to fetch nozzles: " + error.message);
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
            if (editingId) {
                await updateDoc(doc(db, "dispensers", editingId), values);
                message.success("Dispenser updated successfully");
            } else {
                await addDoc(collection(db, "dispensers"), values);
                message.success("Dispenser created successfully");
            }
            setIsModalVisible(false);
            fetchDispensers();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "dispensers", id));
            message.success("Dispenser deleted successfully");
            fetchDispensers();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        }
    };

    const handleExportToExcel = () => {
        exportToExcel(dispensers, 'Dispensers');
        message.success("Exported successfully");
    };

    const columns = [
        {
            title: 'Dispenser ID',
            dataIndex: 'dispenserId',
            key: 'dispenserId',
            sorter: (a, b) => a.dispenserId.localeCompare(b.dispenserId),
        },
        {
            title: 'Dispenser Name',
            dataIndex: 'dispenserName',
            key: 'dispenserName',
            sorter: (a, b) => a.dispenserName.localeCompare(b.dispenserName),
        },
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Badge
                    status={status === 'active' ? 'success' : status === 'maintenance' ? 'warning' : 'error'}
                    text={status.charAt(0).toUpperCase() + status.slice(1)}
                />
            ),
            filters: [
                { text: 'Active', value: 'active' },
                { text: 'Maintenance', value: 'maintenance' },
                { text: 'Inactive', value: 'inactive' },
            ],
            onFilter: (value, record) => record.status === value,
        },
        {
            title: 'Nozzles',
            key: 'nozzles',
            render: (_, record) => {
                const relatedNozzles = nozzles.filter(n => n.dispenserId === record.id);
                return relatedNozzles.length ? relatedNozzles.map(n => n.attachmentId).join(', ') : 'None';
            },
        },
        {
            title: 'Last Maintenance',
            dataIndex: 'lastMaintenance',
            key: 'lastMaintenance',
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
                            title="Are you sure you want to delete this dispenser?"
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

    return (
        <Card className="dispenser-management-container">
            <div className="dispenser-header">
                <Title level={3}>Dispenser Management</Title>
                <Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                    >
                        Add Dispenser
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

            <Table
                columns={columns}
                dataSource={dispensers}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
            />

            <Modal
                title={editingId ? "Edit Dispenser" : "Add New Dispenser"}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="dispenserId"
                        label="Dispenser ID"
                        rules={[{ required: true, message: 'Please enter dispenser ID' }]}
                    >
                        <Input prefix={<ApiOutlined />} placeholder="Enter dispenser ID" />
                    </Form.Item>

                    <Form.Item
                        name="dispenserName"
                        label="Dispenser Name"
                        rules={[{ required: true, message: 'Please enter dispenser name' }]}
                    >
                        <Input placeholder="Enter dispenser name" />
                    </Form.Item>

                    <Form.Item
                        name="location"
                        label="Location"
                        rules={[{ required: true, message: 'Please enter location' }]}
                    >
                        <Input placeholder="Enter location" />
                    </Form.Item>

                    <Form.Item
                        name="status"
                        label="Status"
                        rules={[{ required: true, message: 'Please select status' }]}
                    >
                        <Select placeholder="Select status">
                            <Option value="active">Active</Option>
                            <Option value="maintenance">Maintenance</Option>
                            <Option value="inactive">Inactive</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="lastMaintenance"
                        label="Last Maintenance Date"
                    >
                        <Input type="date" />
                    </Form.Item>

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

export default DispenserManagement;