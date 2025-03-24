import React, { useState, useEffect, useRef } from 'react';
import {
    Table,
    Button,
    Card,
    Typography,
    Select,
    Space,
    Row,
    Col,
    Statistic,
    Divider,
    message,
    Spin,
    Image
} from 'antd';
import moment from 'moment';
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { exportToExcel } from '../../../services/exportService';
import ReactDatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { useSettings } from '../../../context/SettingsContext';

const { Title: TitleTypography } = Typography;
const { Option } = Select;

// Custom date-range picker using react-datepicker
const CustomDateRangePicker = ({ startDate, endDate, onChange }) => {
    return (
        <ReactDatePicker
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={onChange}
            dateFormat="dd/MM/yyyy"
            placeholderText="Select date range"
        />
    );
};

const SalesReportPage = () => {
    const { settings } = useSettings()
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [dateRange, setDateRange] = useState([moment().startOf('day').toDate(), moment().endOf('day').toDate()]);
    const [reportType, setReportType] = useState('daily'); // daily, weekly, monthly, yearly
    const [reportData, setReportData] = useState({
        salesByProduct: [],
        salesByCategory: [],
        grandTotal: 0,
        comparisonData: null
    });

    // Collections data
    const [products, setProducts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [readings, setReadings] = useState([]);
    const [nozzles, setNozzles] = useState([]);
    const [dipChartData, setDipChartData] = useState([]);

    const reportRef = useRef(null);

    useEffect(() => {
        fetchCollectionData();
    }, []);

    useEffect(() => {
        generateReport();
    }, [dateRange, reportType, products, tanks, readings, nozzles]);

    const fetchCollectionData = async () => {
        setLoading(true);
        try {
            // Fetch required collections concurrently (including dipcharts)
            const [
                productsData,
                tanksData,
                readingsData,
                nozzlesData,
                dipChartsData
            ] = await Promise.all([
                getDocs(collection(db, "products")),
                getDocs(collection(db, "tanks")),
                getDocs(collection(db, "readings")),
                getDocs(collection(db, "nozzles")),
                getDocs(collection(db, "dipcharts"))
            ]);

            setProducts(productsData.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setTanks(tanksData.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setReadings(readingsData.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setNozzles(nozzlesData.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setDipChartData(dipChartsData.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error("Failed to fetch data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Generate report data based on the date range and report type
    const generateReport = () => {
        if (!dateRange[0] || !dateRange[1] || products.length === 0) return;
        setLoading(true);
        try {
            const startDate = dateRange[0];
            const endDate = dateRange[1];
            const filteredReadings = readings.filter(reading => {
                const readingDate = reading.timestamp.toDate();
                return readingDate >= startDate && readingDate <= endDate;
            });

            // Calculate sales for each product (showing all products even with zero sales)
            const salesByProduct = products.map(product => {
                const productReadings = filteredReadings.filter(r => r.productId === product.id);
                const totalVolume = productReadings.reduce((sum, r) => sum + (r.salesVolume || 0), 0);
                const totalAmount = productReadings.reduce((sum, r) => sum + (r.salesAmount || 0), 0);
                return {
                    productId: product.id,
                    productName: product.productName,
                    category: product.category || 'Uncategorized',
                    salesPrice: product.salesPrice,
                    totalVolume,
                    totalAmount,
                    readings: productReadings
                };
            });

            // Group product sales by category
            const salesByCategory = calculateSalesByCategory(salesByProduct);
            const grandTotal = salesByProduct.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
            const comparisonData = calculateComparisonData(filteredReadings, grandTotal);

            setReportData({
                salesByProduct,
                salesByCategory,
                grandTotal,
                comparisonData
            });
        } catch (error) {
            message.error("Error generating report: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Group products by category and compute subtotals
    const calculateSalesByCategory = (salesByProduct) => {
        const categoryMap = {};
        salesByProduct.forEach(product => {
            const cat = product.category || 'Uncategorized';
            if (!categoryMap[cat]) {
                categoryMap[cat] = {
                    category: cat,
                    categoryName: cat,
                    products: [],
                    subtotalVolume: 0,
                    subtotalAmount: 0
                };
            }
            categoryMap[cat].products.push(product);
            categoryMap[cat].subtotalVolume += product.totalVolume;
            categoryMap[cat].subtotalAmount += product.totalAmount;
        });
        return Object.values(categoryMap);
    };

    // Calculate comparison data for the "daily" report type
    const calculateComparisonData = (currentReadings, currentTotal) => {
        if (reportType !== 'daily') return null;
        const yesterdayStart = moment().subtract(1, 'day').startOf('day');
        const yesterdayEnd = moment().subtract(1, 'day').endOf('day');
        const yesterdayReadings = readings.filter(reading => {
            const readingDate = reading.timestamp.toDate();
            return readingDate >= yesterdayStart.toDate() && readingDate <= yesterdayEnd.toDate();
        });
        const yesterdaySalesByProduct = products.map(product => {
            const productReadings = yesterdayReadings.filter(r => r.productId === product.id);
            const totalAmount = productReadings.reduce((sum, r) => sum + (r.salesAmount || 0), 0);
            return totalAmount;
        });
        const yesterdayTotal = yesterdaySalesByProduct.reduce((sum, amount) => sum + amount, 0);
        const difference = currentTotal - yesterdayTotal;
        const percentChange = yesterdayTotal > 0 ? (difference / yesterdayTotal) * 100 : 0;
        return {
            previousTotal: yesterdayTotal,
            currentTotal,
            difference,
            percentChange
        };
    };

    const handleDateRangeChange = (dates) => {
        if (dates && dates.length === 2) {
            setDateRange(dates);
        }
    };

    const handleReportTypeChange = (type) => {
        setReportType(type);
        const today = moment();
        switch (type) {
            case 'daily':
                setDateRange([today.clone().startOf('day').toDate(), today.clone().endOf('day').toDate()]);
                break;
            case 'weekly':
                setDateRange([today.clone().subtract(7, 'days').toDate(), today.clone().endOf('day').toDate()]);
                break;
            case 'monthly':
                setDateRange([today.clone().startOf('month').toDate(), today.clone().endOf('day').toDate()]);
                break;
            case 'yearly':
                setDateRange([today.clone().startOf('year').toDate(), today.clone().endOf('day').toDate()]);
                break;
            default:
                setDateRange([today.clone().startOf('day').toDate(), today.clone().endOf('day').toDate()]);
        }
    };

    // Export report to Excel (existing functionality)
    const handleExportToExcel = () => {
        setExportLoading(true);
        try {
            const exportData = {
                reportInfo: {
                    title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Sales Report`,
                    dateRange: `${moment(dateRange[0]).format('DD/MM/YYYY')} - ${moment(dateRange[1]).format('DD/MM/YYYY')}`,
                    generatedOn: moment().format('DD/MM/YYYY HH:mm:ss'),
                    grandTotal: reportData.grandTotal
                },
                salesByCategory: reportData.salesByCategory,
                dipChartData
            };
            exportToExcel(exportData, `Sales_Report_${reportType}_${moment().format('YYYYMMDD')}`);
            message.success("Report exported successfully");
        } catch (error) {
            message.error("Export failed: " + error.message);
        } finally {
            setExportLoading(false);
        }
    };
    // Enhanced PDF export with professional formatting
    const handleExportToPDF = () => {
        setExportLoading(true);
        try {
            // Create PDF document with A4 dimensions
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 15;
            const usableWidth = pageWidth - (margin * 2);

            // Company Name and Info (Replace with your company details)
            const companyName = `${settings.name}`;
            const companyInfo = [
                `Address: ${settings.location}`,
                `Email: ${settings.companyEmail}`,
                `Phone: ${settings.companyPhone}`,

            ];

            // Add company logo
            try {
                pdf.addImage(`${settings.logoUrl}`, 'PNG', margin, margin, 40, 20);
            } catch (logoError) {
                console.warn("Logo could not be added:", logoError);
                // If logo fails, just use text
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text(companyName, margin, margin + 10);
            }

            // Add company info
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            companyInfo.forEach((line, i) => {
                pdf.text(line, pageWidth - margin, margin + 5 + (i * 4), { align: 'right' });
            });

            // Add horizontal line
            pdf.setDrawColor(200, 200, 200);
            pdf.line(margin, margin + 25, pageWidth - margin, margin + 25);

            // Add report title and metadata
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Sales Report`, margin, margin + 35);

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Date Range: ${moment(dateRange[0]).format('DD/MM/YYYY')} - ${moment(dateRange[1]).format('DD/MM/YYYY')}`, margin, margin + 42);
            pdf.text(`Generated on: ${moment().format('DD/MM/YYYY HH:mm:ss')}`, margin, margin + 48);

            let yPosition = margin + 55;

            // Add Sales Summary section
            pdf.setFillColor(240, 240, 240);
            pdf.rect(margin, yPosition, usableWidth, 8, 'F');
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Sales Summary', margin + 5, yPosition + 6);
            yPosition += 15;

            // Add Grand Total with a highlighted box
            pdf.setFillColor(245, 245, 245);
            pdf.rect(margin, yPosition, usableWidth / 2, 15, 'F');
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin, yPosition, usableWidth / 2, 15, 'S');

            pdf.setFont('helvetica', 'bold');
            pdf.text('Grand Total Sales:', margin + 5, yPosition + 10);
            pdf.setTextColor(0, 100, 0); // Dark green for total
            pdf.text(`${reportData.grandTotal.toFixed(2)}`, margin + 60, yPosition + 10);
            pdf.setTextColor(0, 0, 0); // Reset text color
            yPosition += 25;

            // Compare with previous period if available
            if (reportData.comparisonData) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                const change = reportData.comparisonData.percentChange.toFixed(2);
                const changeText = `${change}% ${change >= 0 ? 'increase' : 'decrease'} from previous period`;
                const changeColor = change >= 0 ? [0, 100, 0] : [180, 0, 0];
                pdf.setTextColor(...changeColor);
                pdf.text(changeText, margin, yPosition);
                pdf.setTextColor(0, 0, 0); // Reset text color
                yPosition += 10;
            }

            // Add Category Tables
            reportData.salesByCategory.forEach(category => {
                // Check if we need to add a new page
                if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
                    pdf.addPage();
                    yPosition = margin;
                }

                // Category Header
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, yPosition, usableWidth, 8, 'F');
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`${category.categoryName} Products`, margin + 5, yPosition + 6);
                yPosition += 15;

                // Create table data
                const tableData = category.products.map(product => [
                    product.productName,
                    `${product.salesPrice?.toFixed(2) || '0.00'}`,
                    (product.totalVolume || 0).toFixed(2),
                    `${product.totalAmount?.toFixed(2) || '0.00'}`
                ]);

                // Add category subtotal row
                tableData.push([
                    'Subtotal',
                    '',
                    (category.subtotalVolume || 0).toFixed(2),
                    `${(category.subtotalAmount || 0).toFixed(2)}`
                ]);

                // Add product table with autoTable
                autoTable(pdf, {
                    startY: yPosition,
                    head: [['Product', 'Price (PKR)', 'Volume (L)', 'Total (PKR)']],
                    body: tableData,
                    headStyles: {
                        fillColor: [50, 50, 120],
                        textColor: 255
                    },
                    alternateRowStyles: {
                        fillColor: [245, 245, 245]
                    },
                    footStyles: {
                        fillColor: [240, 240, 240],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold'
                    },
                    margin: { left: margin, right: margin },
                    theme: 'grid',
                    styles: { fontSize: 9 }
                });

                yPosition = pdf.lastAutoTable.finalY + 15;
            });

            // Add Dip Chart Data
            if (dipChartData.length > 0) {
                // Check if we need to add a new page
                if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
                    pdf.addPage();
                    yPosition = margin;
                }

                // Dip Chart Header
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, yPosition, usableWidth, 8, 'F');
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Dip Chart & Inventory Data', margin + 5, yPosition + 6);
                yPosition += 15;

                const dipChartTableData = dipChartData.map(record => {
                    const tank = tanks.find(t => t.id === record.tankId);
                    const tankName = tank ? tank.tankName : 'Unknown';
                    const openingStock = tank ? Number(tank.openingStock) : 0;
                    const diff = record.dipLiters - openingStock;

                    return [
                        tankName,
                        record.dipInches,
                        record.dipLiters,
                        openingStock,
                        diff.toFixed(2),
                        record.recordedAt ? new Date(record.recordedAt).toLocaleString() : '-'
                    ];
                });

                autoTable(pdf, {
                    startY: yPosition,
                    head: [['Tank', 'Dip (inches)', 'Volume (L)', 'Opening Stock', 'Gain/Loss', 'Recorded Date/Time']],
                    body: dipChartTableData,
                    headStyles: {
                        fillColor: [50, 50, 120],
                        textColor: 255
                    },
                    alternateRowStyles: {
                        fillColor: [245, 245, 245]
                    },
                    margin: { left: margin, right: margin },
                    theme: 'grid',
                    styles: { fontSize: 9 },
                    columnStyles: {
                        4: {
                            cellCreator: (cell, data) => {
                                const value = parseFloat(cell.text);
                                if (value > 0) {
                                    cell.styles.textColor = [0, 128, 0]; // Green for positive gain
                                } else if (value < 0) {
                                    cell.styles.textColor = [200, 0, 0]; // Red for loss
                                }
                                return cell;
                            }
                        }
                    }
                });
            }

            // Add footer with page numbers
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);

                // Add horizontal line
                pdf.setDrawColor(200, 200, 200);
                pdf.line(margin, pdf.internal.pageSize.getHeight() - 15, pageWidth - margin, pdf.internal.pageSize.getHeight() - 15);

                // Add page numbers
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pdf.internal.pageSize.getHeight() - 10, {
                    align: 'center'
                });

                // Add company footer
                pdf.text(`© ${new Date().getFullYear()} ${companyName} - Confidential`, margin, pdf.internal.pageSize.getHeight() - 10);

                // Add report ID
                const reportId = `REP-${moment().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`;
                pdf.text(`Report ID: ${reportId}`, pageWidth - margin, pdf.internal.pageSize.getHeight() - 10, {
                    align: 'right'
                });
            }

            pdf.save(`Sales_Report_${reportType}_${moment().format('YYYYMMDD')}.pdf`);
            message.success("PDF report exported successfully");
        } catch (error) {
            console.error(error);
            message.error("PDF export failed: " + error.message);
        } finally {
            setExportLoading(false);
        }
    };

    // Table columns for product sales
    const productColumns = [
        {
            title: 'Product',
            dataIndex: 'productName',
            key: 'productName'
        },
        {
            title: 'Price (PKR)',
            dataIndex: 'salesPrice',
            key: 'salesPrice',
            render: (price) => `₨${price?.toFixed(2) || '0.00'}`
        },
        {
            title: 'Volume Sold (Liters)',
            dataIndex: 'totalVolume',
            key: 'totalVolume',
            render: (volume) => (volume || 0).toFixed(2)
        },
        {
            title: 'Total Sales (PKR)',
            dataIndex: 'totalAmount',
            key: 'totalAmount',
            render: (amount) => `₨${amount?.toFixed(2) || '0.00'}`
        }
    ];

    // Table columns for dip chart data including Opening Stock and Gain/Loss
    const dipChartColumns = [
        {
            title: 'Tank',
            dataIndex: 'tankId',
            key: 'tankId',
            render: (tankId) => {
                const tank = tanks.find(t => t.id === tankId);
                return tank ? tank.tankName : 'Unknown';
            }
        },
        {
            title: 'Dip (inches)',
            dataIndex: 'dipInches',
            key: 'dipInches'
        },
        {
            title: 'Volume (liters)',
            dataIndex: 'dipLiters',
            key: 'dipLiters'
        },
        {
            title: 'Opening Stock',
            key: 'openingStock',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                return tank ? tank.openingStock : '-';
            }
        },
        {
            title: 'Gain/Loss',
            key: 'gainLoss',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                const openingStock = tank ? Number(tank.openingStock) : 0;
                const diff = record.dipLiters - openingStock;
                const color = diff > 0 ? 'green' : diff < 0 ? 'red' : 'black';
                return <span style={{ color }}>{diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}</span>;
            }
        },
        {
            title: 'Recorded Date/Time',
            dataIndex: 'recordedAt',
            key: 'recordedAt',
            render: (date) => date ? new Date(date).toLocaleString() : '-'
        }
    ];

    return (
        <Card className="sales-report-container">
            <div className="report-header" style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={8}>
                        <TitleTypography level={3}>Sales Reports</TitleTypography>
                    </Col>
                    <Col xs={24} md={16}>
                        <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Select
                                value={reportType}
                                onChange={handleReportTypeChange}
                                style={{ width: 120 }}
                            >
                                <Option value="daily">Daily</Option>
                                <Option value="weekly">Weekly</Option>
                                <Option value="monthly">Monthly</Option>
                                <Option value="yearly">Yearly</Option>
                            </Select>
                            <CustomDateRangePicker
                                startDate={dateRange[0]}
                                endDate={dateRange[1]}
                                onChange={handleDateRangeChange}
                            />
                            <Button
                                type="primary"
                                icon={<FileExcelOutlined />}
                                onClick={handleExportToExcel}
                                loading={exportLoading}
                            >
                                Export Excel
                            </Button>
                            <Button
                                type="primary"
                                icon={<FilePdfOutlined />}
                                onClick={handleExportToPDF}
                                loading={exportLoading}
                            >
                                Export PDF
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </div>

            {/* Report Content Container for screen display */}
            <div id="report-content" ref={reportRef}>
                <Spin spinning={loading}>
                    {/* Product Sales Grouped by Category */}
                    <Divider orientation="center">Product Sales by Category</Divider>
                    {reportData.salesByCategory.map(category => (
                        <div key={category.category} style={{ marginBottom: 30 }}>
                            <Divider orientation="left">{category.categoryName}</Divider>
                            <Table
                                columns={productColumns}
                                dataSource={category.products}
                                rowKey="productId"
                                pagination={false}
                                summary={() => (
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0}><strong>Subtotal</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1}></Table.Summary.Cell>
                                        <Table.Summary.Cell index={2}><strong>{(category.subtotalVolume || 0).toFixed(2)}</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={3}><strong>₨{(category.subtotalAmount || 0).toFixed(2)}</strong></Table.Summary.Cell>
                                    </Table.Summary.Row>
                                )}
                            />
                        </div>
                    ))}
                    <Row style={{ marginBottom: 30 }}>
                        <Col span={12}>
                            <Statistic
                                title="Grand Total Sales (PKR)"
                                value={reportData.grandTotal}
                                precision={2}
                                prefix="₨"
                            />
                        </Col>
                    </Row>

                    {/* Dip Chart Data Section */}
                    <Divider orientation="center">Dip Chart Data</Divider>
                    <Table
                        columns={dipChartColumns}
                        dataSource={dipChartData}
                        rowKey="id"
                        pagination={false}
                        bordered
                    />
                </Spin>
            </div>
        </Card>
    );
};

export default SalesReportPage;