import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Space, Card,
    Typography, message, Tooltip, Popconfirm, Progress, InputNumber, DatePicker, Select, Statistic, Row, Col
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
const { Option } = Select;

const TankManagement = () => {
    const [tanks, setTanks] = useState([]);
    const [productsList, setProductsList] = useState([]); // For linking tanks with products
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    const { isAdmin } = useAuth();

    useEffect(() => {
        fetchTanks();
        fetchProducts();
    }, []);

    // Fetch tanks from Firestore
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

    // Fetch products to link with tanks
    const fetchProducts = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const products = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProductsList(products);
        } catch (error) {
            message.error("Failed to fetch products: " + error.message);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue(record);
        } else {
            setEditingId(null);
            form.resetFields();
            // Optionally, set a default value for openingStock if needed
            form.setFieldsValue({
                openingStock: 0
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
            // If openingStock is not provided, set it to 0
            if (values.openingStock === undefined) {
                values.openingStock = 0;
            }
            if (editingId) {
                await updateDoc(doc(db, "tanks", editingId), values);
                message.success("Tank updated successfully");
            } else {
                await addDoc(collection(db, "tanks"), {
                    ...values,
                    createdAt: new Date()
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

    const columns = [
        {
            title: 'Tank Name',
            dataIndex: 'tankName',
            key: 'tankName',
            sorter: (a, b) => a.tankName.localeCompare(b.tankName),
        },
        {
            title: 'Product',
            dataIndex: 'product',
            key: 'product',
            render: (productId) => {
                const product = productsList.find(p => p.id === productId);
                return product ? product.productName : 'N/A';
            }
        },
        {
            title: 'Capacity (Liters)',
            dataIndex: 'capacity',
            key: 'capacity',
            sorter: (a, b) => a.capacity - b.capacity,
        },
        {
            title: 'Opening Stock (Liters)',
            dataIndex: 'openingStock',
            key: 'openingStock',
            render: (stock, record) => (
                <Progress
                    percent={record.capacity ? (stock / record.capacity) * 100 : 0}
                    size="small"
                    status={record.capacity && (stock / record.capacity) < 0.2 ? 'exception' : 'normal'}
                />
            ),
            sorter: (a, b) => a.openingStock - b.openingStock,
        },
        {
            title: 'Low Level Alert Threshold (Liters)',
            dataIndex: 'alertThreshold',
            key: 'alertThreshold',
            sorter: (a, b) => a.alertThreshold - b.alertThreshold,
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
                            name="tankName"
                            label="Tank Name"
                            rules={[{ required: true, message: 'Please enter tank name' }]}
                        >
                            <Input placeholder="Enter tank name" />
                        </Form.Item>

                        <Form.Item
                            name="product"
                            label="Product"
                            rules={[{ required: true, message: 'Please select a product' }]}
                        >
                            <Select placeholder="Select product">
                                {productsList.map(product => (
                                    <Option key={product.id} value={product.id}>
                                        {product.productName}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="capacity"
                            label="Capacity (Liters)"
                            rules={[{ required: true, message: 'Please enter tank capacity' }]}
                        >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter capacity in liters" />
                        </Form.Item>

                        <Form.Item
                            name="openingStock"
                            label="Opening Stock (Liters)"
                            rules={[{ required: true, message: 'Please enter opening stock' }]}
                        >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter opening stock in liters" />
                        </Form.Item>

                        <Form.Item
                            name="alertThreshold"
                            label="Low Level Alert Threshold (Liters)"
                            rules={[{ required: true, message: 'Please enter alert threshold' }]}
                        >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter threshold" />
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={submitLoading} disabled={submitLoading}>
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
