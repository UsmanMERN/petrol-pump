import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, DatePicker, message, Select, InputNumber, Row, Typography, Col, Card } from 'antd';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import moment from 'moment';

const { Option } = Select;
const { Title } = Typography;
const SaleInvoiceManagement = () => {
    const [invoices, setInvoices] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [customerFilter, setCustomerFilter] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchInvoices();
        fetchCustomers();
        fetchProducts();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'saleInvoices'));
            setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error('Failed to fetch invoices: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'accounts'));
            setCustomers(
                querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(account => account.accountType === "customer")
            );
        } catch (error) {
            message.error('Failed to fetch customers: ' + error.message);
        }
    };

    const fetchProducts = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'products'));
            setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error('Failed to fetch products: ' + error.message);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue({
                ...record,
                date: record.date ? moment(record.date) : moment(),
            });
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ date: moment() });
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleSubmit = async (values) => {
        setSubmitting(true);
        try {
            const { quantity, unitPrice, ...rest } = values;
            const amount = quantity * unitPrice;
            const data = {
                ...rest,
                quantity,
                unitPrice,
                amount,
                date: values.date.toISOString()
            };
            if (editingId) {
                await updateDoc(doc(db, 'saleInvoices', editingId), data);
                message.success('Sale invoice updated');
            } else {
                await addDoc(collection(db, 'saleInvoices'), data);
                message.success('Sale invoice created');
            }
            setIsModalVisible(false);
            fetchInvoices();
        } catch (error) {
            message.error('Operation failed: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this invoice?',
            onOk: async () => {
                try {
                    await deleteDoc(doc(db, 'saleInvoices', id));
                    message.success('Sale invoice deleted');
                    fetchInvoices();
                } catch (error) {
                    message.error('Delete failed: ' + error.message);
                }
            },
        });
    };

    // Filter invoices by customer if filter is selected
    const filteredInvoices = customerFilter
        ? invoices.filter(invoice => invoice.customerId === customerFilter)
        : invoices;

    const columns = [
        {
            title: 'Customer',
            dataIndex: 'customerId',
            key: 'customerId',
            render: customerId => {
                const customer = customers.find(c => c.id === customerId);
                return customer ? customer.accountName : 'Unknown';
            },
        },
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: text => new Date(text).toLocaleDateString()
        },
        {
            title: 'Product',
            dataIndex: 'productId',
            key: 'productId',
            render: productId => {
                const product = products.find(p => p.id === productId);
                return product ? product.productName : 'Unknown';
            },
        },
        {
            title: 'Quantity (Liters)',
            dataIndex: 'quantity',
            key: 'quantity'
        },
        {
            title: 'Unit Price',
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            render: price => `${parseFloat(price).toFixed(2)}`
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: amount => `${parseFloat(amount).toFixed(2)}`
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <>
                    <Button onClick={() => showModal(record)}>Edit</Button>
                    <Button danger onClick={() => handleDelete(record.id)} style={{ marginLeft: 8 }}>
                        Delete
                    </Button>
                </>
            ),
        },
    ];

    return (
        <Card>
            <div style={{ marginBottom: 16, display: 'flex', gap: '16px', alignItems: 'center' }}>
                <Row justify="space-between" style={{ width: '100%' }}>
                    <Title level={2} style={{ marginBottom: '20px' }}>Sale Invoices</Title>
                    <Col >
                        <Button className='me-3' type="primary" onClick={() => showModal()}>
                            Add Sale Invoice
                        </Button>
                        <Select
                            placeholder="Filter by Customer"
                            allowClear
                            style={{ width: 200 }}
                            onChange={(value) => setCustomerFilter(value)}
                        >
                            {customers.map(customer => (
                                <Option key={customer.id} value={customer.id}>
                                    {customer.accountName}
                                </Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </div>
            <Table dataSource={filteredInvoices} columns={columns} rowKey="id" loading={loading} />
            <Modal
                title={editingId ? 'Edit Sale Invoice' : 'Add Sale Invoice'}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form form={form} onFinish={handleSubmit} layout="vertical">
                    <Form.Item
                        name="customerId"
                        label="Customer"
                        rules={[{ required: true, message: 'Please select a customer' }]}
                    >
                        <Select placeholder="Select a customer">
                            {customers.map(customer => (
                                <Option key={customer.id} value={customer.id}>
                                    {customer.accountName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="date"
                        label="Date"
                        rules={[{ required: true, message: 'Please select a date' }]}
                    >
                        <DatePicker style={{ width: '100%' }} initialValues={moment()} />
                    </Form.Item>
                    <Form.Item
                        name="productId"
                        label="Product"
                        rules={[{ required: true, message: 'Please select a product' }]}
                    >
                        <Select placeholder="Select a product">
                            {products.map(product => (
                                <Option key={product.id} value={product.id}>
                                    {product.productName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="quantity"
                        label="Quantity (Liters)"
                        rules={[{ required: true, message: 'Please enter quantity' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                        name="unitPrice"
                        label="Unit Price"
                        rules={[{ required: true, message: 'Please enter unit price' }]}
                    >
                        <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value.replace(/\$\s?|(,*)/g, '')}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
                            {editingId ? 'Update' : 'Create'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default SaleInvoiceManagement;
