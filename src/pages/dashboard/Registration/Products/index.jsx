import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber, Select,
    Statistic, Row, Col
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, SearchOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';
import { useAuth } from '../../../../context/AuthContext';

const { Title } = Typography;

const ProductManagement = () => {
    const [products, setProducts] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    const { isAdmin } = useAuth();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const productList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(productList);
        } catch (error) {
            message.error("Failed to fetch products: " + error.message);
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
        setSubmitLoading(true);
        try {
            // Set default for optional field openingQuantity if it's undefined
            if (values.openingQuantity === undefined) {
                values.openingQuantity = 0;
            }
            if (editingId) {
                await updateDoc(doc(db, "products", editingId), values);
                message.success("Product updated successfully");
            } else {
                await addDoc(collection(db, "products"), values);
                message.success("Product created successfully");
            }
            setIsModalVisible(false);
            fetchProducts();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleteLoading(true);
        try {
            await deleteDoc(doc(db, "products", id));
            message.success("Product deleted successfully");
            fetchProducts();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleExportToExcel = () => {
        setExportLoading(true);
        try {
            exportToExcel(products, 'Products');
            message.success("Exported successfully");
        } catch (error) {
            message.error("Export failed: " + error.message);
        } finally {
            setExportLoading(false);
        }
    };

    const columns = [
        {
            title: 'Product Name',
            dataIndex: 'productName',
            key: 'productName',
            sorter: (a, b) => a.productName.localeCompare(b.productName),
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            sorter: (a, b) => a.category.localeCompare(b.category),
        },
        {
            title: 'Purchase Price (PKR)',
            dataIndex: 'purchasePrice',
            key: 'purchasePrice',
            render: (price) => `₨${price?.toFixed(2)}`,
            sorter: (a, b) => a.purchasePrice - b.purchasePrice,
        },
        {
            title: 'Sales Price (PKR)',
            dataIndex: 'salesPrice',
            key: 'salesPrice',
            render: (price) => `₨${price?.toFixed(2)}`,
            sorter: (a, b) => a.salesPrice - b.salesPrice,
        },
        {
            title: 'Opening Quantity',
            dataIndex: 'openingQuantity',
            key: 'openingQuantity',
            sorter: (a, b) => a.openingQuantity - b.openingQuantity,
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
                            title="Are you sure you want to delete this product?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                                loading={deleteLoading}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const filteredProducts = products.filter(product =>
        product.productName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const calculateTotalValue = () => {
        return products.reduce((sum, product) => {
            return sum + (product.salesPrice * (product.openingQuantity || 0));
        }, 0);
    };

    return (
        <Card className="product-management-container">
            <div className="product-header d-flex justify-content-between flex-wrap mb-3">
                <Title level={3}>Product Management</Title>
                <Space wrap>
                    <Input
                        placeholder="Search by product name"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: 300 }}
                        prefix={<SearchOutlined />}
                        allowClear
                    />
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                    >
                        Add Product
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

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8}>
                    <Statistic
                        title="Total Products"
                        value={products.length}
                    />
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Statistic
                        title="Total Inventory Value (PKR)"
                        value={calculateTotalValue()}
                        precision={2}
                        prefix="₨"
                    />
                </Col>
            </Row>

            <div className="table-responsive">
                <Table
                    columns={columns}
                    dataSource={filteredProducts}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, responsive: true }}
                    bordered
                    scroll={{ x: 'max-content' }}
                />
            </div>

            {/* Add/Edit Product Modal */}
            <Modal
                title={editingId ? "Edit Product" : "Add New Product"}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                width="90%"
                style={{ maxWidth: '500px' }}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '16px'
                    }}>
                        <Form.Item
                            name="productName"
                            label="Product Name"
                            rules={[{ required: true, message: 'Please enter product name' }]}
                        >
                            <Input placeholder="Enter product name" />
                        </Form.Item>

                        <Form.Item
                            name="category"
                            label="Category"
                            rules={[{ required: true, message: 'Please select category' }]}
                        >
                            <Select placeholder="Select category">
                                <Select.Option value="petrol">Petrol</Select.Option>
                                <Select.Option value="diesel">Diesel</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="purchasePrice"
                            label="Purchase Price (PKR)"
                            rules={[{ required: true, message: 'Please enter purchase price' }]}
                        >
                            <InputNumber
                                min={0}
                                step={0.01}
                                style={{ width: '100%' }}
                                placeholder="Enter purchase price"
                                formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/₨\s?|(,*)/g, '')}
                            />
                        </Form.Item>

                        <Form.Item
                            name="salesPrice"
                            label="Sales Price (PKR)"
                            rules={[{ required: true, message: 'Please enter sales price' }]}
                        >
                            <InputNumber
                                min={0}
                                step={0.01}
                                style={{ width: '100%' }}
                                placeholder="Enter sales price"
                                formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/₨\s?|(,*)/g, '')}
                            />
                        </Form.Item>

                        <Form.Item
                            name="openingQuantity"
                            label="Opening Quantity (Optional)"
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Enter opening quantity"
                            />
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
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

export default ProductManagement;
