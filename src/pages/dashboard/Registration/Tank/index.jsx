import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Space, Card,
    Typography, message, Tooltip, Popconfirm, Progress, InputNumber
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';

const { Title } = Typography;

const TankManagement = () => {
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTanks();
    }, []);

    const fetchTanks = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "tanks"));
            const tankList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTanks(tankList);
        } catch (error) {
            message.error("Failed to fetch tanks: " + error.message);
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
            if (editingId) {
                await updateDoc(doc(db, "tanks", editingId), values);
                message.success("Tank updated successfully");
            } else {
                await addDoc(collection(db, "tanks"), values);
                message.success("Tank created successfully");
            }
            setIsModalVisible(false);
            fetchTanks();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "tanks", id));
            message.success("Tank deleted successfully");
            fetchTanks();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        }
    };

    const handleExportToExcel = () => {
        exportToExcel(tanks, 'Tanks');
        message.success("Exported successfully");
    };

    useEffect(() => {
        tanks.forEach(tank => {
            if (tank.currentLevel < tank.alertThreshold) {
                message.warning(`Tank ${tank.tankName} is below threshold!`);
            }
        });
    }, [tanks]);

    const columns = [
        {
            title: 'Tank ID',
            dataIndex: 'tankId',
            key: 'tankId',
            sorter: (a, b) => a.tankId.localeCompare(b.tankId),
        },
        {
            title: 'Tank Name',
            dataIndex: 'tankName',
            key: 'tankName',
            sorter: (a, b) => a.tankName.localeCompare(b.tankName),
        },
        {
            title: 'Capacity (Liters)',
            dataIndex: 'capacity',
            key: 'capacity',
            sorter: (a, b) => a.capacity - b.capacity,
        },
        {
            title: 'Current Level (Liters)',
            dataIndex: 'currentLevel',
            key: 'currentLevel',
            render: (level, record) => (
                <Progress
                    percent={(level / record.capacity) * 100}
                    size="small"
                    status={level / record.capacity < 0.2 ? 'exception' : 'normal'}
                />
            ),
            sorter: (a, b) => a.currentLevel - b.currentLevel,
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
                            title="Are you sure you want to delete this tank?"
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
        <Card className="tank-management-container">
            <div className="tank-header">
                <Title level={3}>Tank Management</Title>
                <Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                    >
                        Add Tank
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
                dataSource={tanks}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
            />

            <Modal
                title={editingId ? "Edit Tank" : "Add New Tank"}
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
                        name="tankId"
                        label="Tank ID"
                        rules={[{ required: true, message: 'Please enter tank ID' }]}
                    >
                        <Input prefix={<DatabaseOutlined />} placeholder="Enter tank ID" />
                    </Form.Item>

                    <Form.Item
                        name="tankName"
                        label="Tank Name"
                        rules={[{ required: true, message: 'Please enter tank name' }]}
                    >
                        <Input placeholder="Enter tank name" />
                    </Form.Item>

                    <Form.Item
                        name="capacity"
                        label="Capacity (Liters)"
                        rules={[{ required: true, message: 'Please enter tank capacity' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter capacity in liters" />
                    </Form.Item>

                    <Form.Item
                        name="currentLevel"
                        label="Current Level (Liters)"
                        rules={[{ required: true, message: 'Please enter current level' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter current level in liters" />
                    </Form.Item>

                    <Form.Item
                        name="alertThreshold"
                        label="Low Level Alert Threshold (Liters)"
                        rules={[{ required: true, message: 'Please enter alert threshold' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter threshold" />
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

export default TankManagement;