import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Space, Card,
    Typography, message, Tooltip, Popconfirm, Progress, InputNumber, Select
} from 'antd';
import moment from 'moment';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';
import { useAuth } from '../../../../context/AuthContext';

const { Title } = Typography;
const { Option } = Select;

const TankManagement = () => {
    const [tanks, setTanks] = useState([]);
    const [productsList, setProductsList] = useState([]);
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
            message.error(`Failed to fetch tanks: ${error.message}`);
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
            message.error(`Failed to fetch products: ${error.message}`);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue(record);
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ openingStock: 0 });
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
            // Default openingStock to 0 if not provided
            values.openingStock = values.openingStock ?? 0;

            // Ensure numerical values have 2 decimal places
            values.openingStock = parseFloat(values.openingStock.toFixed(2));
            values.capacity = parseFloat(values.capacity.toFixed(2));
            values.alertThreshold = parseFloat(values.alertThreshold.toFixed(2));

            // Validate openingStock does not exceed capacity
            if (values.openingStock > values.capacity) {
                message.error("Opening stock cannot exceed tank capacity.");
                setSubmitLoading(false);
                return;
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
            message.error(`Operation failed: ${error.message}`);
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
            message.error(`Delete failed: ${error.message}`);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleExportToExcel = () => {
        setExportLoading(true);
        try {
            if (tanks.length === 0) {
                message.warning("No tanks available to export.");
                setExportLoading(false);
                return;
            }
            const formattedTanks = tanks.map(tank => ({
                ...tank,
                capacity: parseFloat(tank.capacity.toFixed(2)),
                openingStock: parseFloat(tank.openingStock.toFixed(2)),
                alertThreshold: parseFloat(tank.alertThreshold.toFixed(2))
            }));
            exportToExcel(formattedTanks, 'Tanks');
            message.success("Tanks exported successfully");
        } catch (error) {
            message.error(`Export failed: ${error.message}`);
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
            },
            sorter: (a, b) => {
                const productA = productsList.find(p => p.id === a.product)?.productName || '';
                const productB = productsList.find(p => p.id === b.product)?.productName || '';
                return productA.localeCompare(productB);
            }
        },
        {
            title: 'Capacity (Liters)',
            dataIndex: 'capacity',
            key: 'capacity',
            render: (capacity) => parseFloat(capacity).toFixed(2),
            sorter: (a, b) => a.capacity - b.capacity,
        },
        {
            title: 'Opening Stock (Liters)',
            dataIndex: 'openingStock',
            key: 'openingStock',
            render: (stock) => parseFloat(stock).toFixed(2),
            sorter: (a, b) => a.openingStock - b.openingStock,
        },
        {
            title: 'Opening Volume',
            dataIndex: 'openingStock',
            key: 'openingVolume',
            render: (stock, record) => (
                <Progress
                    percent={record.capacity ? parseFloat((stock / record.capacity) * 100).toFixed(2) : 0}
                    size="small"
                    status={record.capacity && (stock / record.capacity) < 0.2 ? 'exception' : 'normal'}
                />
            ),
            sorter: (a, b) => (a.openingStock / a.capacity) - (b.openingStock / b.capacity),
        },
        {
            title: 'Low Level Alert Threshold (Liters)',
            dataIndex: 'alertThreshold',
            key: 'alertThreshold',
            render: (threshold) => parseFloat(threshold).toFixed(2),
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
                            disabled={!isAdmin} // Restrict to admins
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this tank?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                            okButtonProps={{ loading: deleteLoading === record.id }}
                            disabled={!isAdmin} // Restrict to admins
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                                loading={deleteLoading === record.id}
                                disabled={!isAdmin}
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
                        disabled={!isAdmin} // Restrict to admins
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
                            <Select placeholder="Select product" disabled={productsList.length === 0}>
                                {productsList.length > 0 ? (
                                    productsList.map(product => (
                                        <Option key={product.id} value={product.id}>
                                            {product.productName}
                                        </Option>
                                    ))
                                ) : (
                                    <Option disabled>No products available</Option>
                                )}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="capacity"
                            label="Capacity (Liters)"
                            rules={[
                                { required: true, message: 'Please enter tank capacity' },
                                { type: 'number', min: 0, message: 'Capacity must be a positive number' }
                            ]}
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Enter capacity in liters"
                                precision={2}
                            />
                        </Form.Item>

                        <Form.Item
                            name="openingStock"
                            label="Opening Stock (Liters)"
                            rules={[
                                { required: true, message: 'Please enter opening stock' },
                                { type: 'number', min: 0, message: 'Opening stock must be a positive number' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('capacity') >= value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Opening stock cannot exceed capacity'));
                                    },
                                }),
                            ]}
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Enter opening stock in liters"
                                precision={2}
                            />
                        </Form.Item>

                        <Form.Item
                            name="alertThreshold"
                            label="Low Level Alert Threshold (Liters)"
                            rules={[
                                { required: true, message: 'Please enter alert threshold' },
                                { type: 'number', min: 0, message: 'Threshold must be a positive number' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('capacity') >= value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Threshold cannot exceed capacity'));
                                    },
                                }),
                            ]}
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Enter threshold"
                                precision={2}
                            />
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitLoading}
                                disabled={submitLoading || !isAdmin}
                            >
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