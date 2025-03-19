import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, SearchOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';

const { Title } = Typography;
const { Option } = Select;

const ProductManagement = () => {
    const [products, setProducts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchProducts();
        fetchTanks();
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

    const fetchTanks = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "tanks"));
            const tankList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTanks(tankList);
        } catch (error) {
            message.error("Failed to fetch tanks: " + error.message);
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
                const existingProduct = products.find(p => p.id === editingId);
                const newPriceHistory = existingProduct.priceHistory || [];
                if (existingProduct.salesPrice !== values.salesPrice) {
                    newPriceHistory.push({
                        price: values.salesPrice,
                        date: new Date().toISOString(),
                    });
                }
                values.priceHistory = newPriceHistory;
                await updateDoc(doc(db, "products", editingId), values);
                message.success("Product updated successfully");
            } else {
                values.priceHistory = [];
                await addDoc(collection(db, "products"), values);
                message.success("Product created successfully");
            }
            setIsModalVisible(false);
            fetchProducts();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "products", id));
            message.success("Product deleted successfully");
            fetchProducts();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        }
    };

    const handleExportToExcel = () => {
        exportToExcel(products, 'Products');
        message.success("Exported successfully");
    };

    const columns = [
        {
            title: 'Product ID',
            dataIndex: 'productId',
            key: 'productId',
            sorter: (a, b) => a.productId.localeCompare(b.productId),
        },
        {
            title: 'Product Name',
            dataIndex: 'productName',
            key: 'productName',
            sorter: (a, b) => a.productName.localeCompare(b.productName),
        },
        {
            title: 'Brand',
            dataIndex: 'brand',
            key: 'brand',
        },
        {
            title: 'Store',
            dataIndex: 'store',
            key: 'store',
            render: (storeId) => {
                const tank = tanks.find(tank => tank.id === storeId);
                return tank ? tank.tankName : 'Unknown';
            }
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
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
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
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const filteredProducts = products.filter(product =>
        product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.productId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card className="product-management-container">
            <div className="product-header">
                <Title level={3}>Product Management</Title>
                <Space>
                    <Input
                        placeholder="Search by name or ID"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: 300 }}
                        prefix={<SearchOutlined />}
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
                    >
                        Export to Excel
                    </Button>
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={filteredProducts}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
                scroll={{ x: 'max-content' }}
            />

            <Modal
                title={editingId ? "Edit Product" : "Add New Product"}
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
                            name="productId"
                            label="Product ID"
                            rules={[{ required: true, message: 'Please enter product ID' }]}
                        >
                            <Input placeholder="Enter product ID" />
                        </Form.Item>

                        <Form.Item
                            name="productName"
                            label="Product Name"
                            rules={[{ required: true, message: 'Please enter product name' }]}
                        >
                            <Input placeholder="Enter product name" />
                        </Form.Item>

                        <Form.Item
                            name="openingQuantity"
                            label="Opening Quantity"
                            rules={[{ required: true, message: 'Please enter opening quantity' }]}
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Enter opening quantity"
                            />
                        </Form.Item>

                        <Form.Item
                            name="store"
                            label="Store (Tank)"
                            rules={[{ required: true, message: 'Please select store' }]}
                        >
                            <Select placeholder="Select tank">
                                {tanks.map(tank => (
                                    <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="brand"
                            label="Brand"
                            rules={[{ required: true, message: 'Please enter brand' }]}
                        >
                            <Input placeholder="Enter brand" />
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
                            name="batchNo"
                            label="Batch Number"
                            rules={[{ required: true, message: 'Please enter batch number' }]}
                        >
                            <Input placeholder="Enter batch number" />
                        </Form.Item>

                        <Form.Item
                            name="category"
                            label="Category"
                            rules={[{ required: true, message: 'Please enter category' }]}
                        >
                            <Input placeholder="Enter category" />
                        </Form.Item>

                        <Form.Item
                            name="priceHistory"
                            label="Price History"
                            hidden
                        >
                            <Input />
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

export default ProductManagement;