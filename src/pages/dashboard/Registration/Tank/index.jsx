import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Space, Card,
    Typography, message, Tooltip, Popconfirm, Progress, InputNumber, DatePicker
} from 'antd';
import moment from 'moment';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, DatabaseOutlined, CalendarOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';
import { useAuth } from '../../../../context/AuthContext';

const { Title } = Typography;

const TankManagement = () => {
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    const { isAdmin } = useAuth(); // Assuming your auth context provides this

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
            form.setFieldsValue({
                ...record,
                lastUpdated: record.lastUpdated ? moment(record.lastUpdated.toDate()) : null
            });
        } else {
            setEditingId(null);
            form.resetFields();
            // Set default value for new records
            form.setFieldsValue({
                lastUpdated: moment()
            });
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleSubmit = async (values) => {
        setSubmitLoading(true);
        try {
            const formattedValues = {
                ...values,
                lastUpdated: values.lastUpdated.toDate(), // Convert Moment to Date
            };

            if (editingId) {
                await updateDoc(doc(db, "tanks", editingId), formattedValues);
                message.success("Tank updated successfully");
            } else {
                await addDoc(collection(db, "tanks"), {
                    ...formattedValues,
                    createdAt: new Date(),
                });
                message.success("Tank created successfully");
            }
            setIsModalVisible(false);
            fetchTanks();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleteLoading(id);
        try {
            await deleteDoc(doc(db, "tanks", id));
            message.success("Tank deleted successfully");
            fetchTanks();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleExportToExcel = () => {
        setExportLoading(true);
        try {
            exportToExcel(tanks, 'Tanks');
            message.success("Exported successfully");
        } catch (error) {
            message.error("Export failed: " + error.message);
        } finally {
            setExportLoading(false);
        }
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
            title: 'Last Updated',
            dataIndex: 'lastUpdated',
            key: 'lastUpdated',
            render: (lastUpdated) => lastUpdated ? moment(lastUpdated.toDate()).format('DD/MM/YYYY HH:mm:ss') : 'Never',
            sorter: (a, b) => {
                if (!a.lastUpdated) return -1;
                if (!b.lastUpdated) return 1;
                return a.lastUpdated.toDate() - b.lastUpdated.toDate();
            },
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
                            okButtonProps={{ loading: deleteLoading === record.id }}
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                                loading={deleteLoading === record.id}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <Card className="tank-management-container">
            <div className="tank-header d-flex justify-content-between flex-wrap mb-3">
                <Title level={3}>Tank Management</Title>
                <Space wrap>
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
                        loading={exportLoading}
                    >
                        Export to Excel
                    </Button>
                </Space>
            </div>

            <div className="table-responsive">
                <Table
                    columns={columns}
                    dataSource={tanks}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, responsive: true }}
                    bordered
                    scroll={{ x: 'max-content' }}
                />
            </div>

            <Modal
                title={editingId ? "Edit Tank" : "Add New Tank"}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

                        <Form.Item
                            name="lastUpdated"
                            label="Last Updated Date/Time"
                            rules={[{ required: true, message: 'Please select date and time' }]}
                        >
                            <DatePicker
                                showTime
                                format="YYYY-MM-DD HH:mm:ss"
                                style={{ width: '100%' }}
                                disabled={!isAdmin}
                                placeholder="Select date and time"
                                prefix={<CalendarOutlined />}
                            />
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={submitLoading}>
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