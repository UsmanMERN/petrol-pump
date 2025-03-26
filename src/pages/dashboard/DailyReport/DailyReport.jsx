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
    Modal,
    Form,
    InputNumber,
    Input
} from 'antd';
import moment from 'moment';
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { exportToExcel } from '../../../services/exportService';
import ReactDatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { mmArray, ltrArray } from '../../../data/dipdata';
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

const getLiters = (mm) => {
    if (mm < mmArray[0]) {
        return 0;
    }
    if (mm > mmArray[mmArray.length - 1]) {
        return ltrArray[ltrArray.length - 1];
    }
    for (let i = 0; i < mmArray.length - 1; i++) {
        if (mm >= mmArray[i] && mm <= mmArray[i + 1]) {
            const slope = (ltrArray[i + 1] - ltrArray[i]) / (mmArray[i + 1] - mmArray[i]);
            const liters = ltrArray[i] + slope * (mm - mmArray[i]);
            return Number(liters.toFixed(1));
        }
    }
    return null;
};

const SalesReportPage = () => {
    const { settings } = useSettings();
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

    // New state for modals/forms (record reading and record dip chart)
    const [isReadingModalVisible, setIsReadingModalVisible] = useState(false);
    const [isDipChartModalVisible, setIsDipChartModalVisible] = useState(false);
    const [readingForm] = Form.useForm();
    const [dipChartForm] = Form.useForm();

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

            const salesByProduct = products.map(product => {
                const productReadings = filteredReadings.filter(r => r.productId === product.id);
                const totalVolume = productReadings.reduce((sum, r) => sum + (r.salesVolume || 0), 0);
                const totalAmount = productReadings.reduce((sum, r) => sum + (r.salesAmount || 0), 0);
                const totalPreviousReading = productReadings.reduce((sum, r) => sum + (r.previousReading || 0), 0);
                const totalCurrentReading = productReadings.reduce((sum, r) => sum + (r.currentReading || 0), 0);
                return {
                    productId: product.id,
                    productName: product.productName,
                    category: product.category || 'Uncategorized',
                    salesPrice: product.salesPrice,
                    totalVolume,
                    totalAmount,
                    totalPreviousReading,
                    totalCurrentReading,
                    readings: productReadings
                };
            });

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

    const handleExportToPDF = () => {
        setExportLoading(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 15;
            const usableWidth = pageWidth - (margin * 2);
            const companyName = `${settings.name}`;
            const companyInfo = [
                `Address: ${settings.location}`,
                `Email: ${settings.companyEmail}`,
                `Phone: ${settings.companyPhone}`,
            ];

            try {
                pdf.addImage(`${settings.logoUrl}`, 'PNG', margin, margin, 40, 20);
            } catch (logoError) {
                console.warn("Logo could not be added:", logoError);
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text(companyName, margin, margin + 10);
            }

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            companyInfo.forEach((line, i) => {
                pdf.text(line, pageWidth - margin, margin + 5 + (i * 4), { align: 'right' });
            });

            pdf.setDrawColor(200, 200, 200);
            pdf.line(margin, margin + 25, pageWidth - margin, margin + 25);

            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Sales Report`, margin, margin + 35);

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Date Range: ${moment(dateRange[0]).format('DD/MM/YYYY')} - ${moment(dateRange[1]).format('DD/MM/YYYY')}`, margin, margin + 42);
            pdf.text(`Generated on: ${moment().format('DD/MM/YYYY HH:mm:ss')}`, margin, margin + 48);

            let yPosition = margin + 55;

            pdf.setFillColor(240, 240, 240);
            pdf.rect(margin, yPosition, usableWidth, 8, 'F');
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Sales Summary', margin + 5, yPosition + 6);
            yPosition += 15;

            pdf.setFillColor(245, 245, 245);
            pdf.rect(margin, yPosition, usableWidth / 2, 15, 'F');
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin, yPosition, usableWidth / 2, 15, 'S');

            pdf.setFont('helvetica', 'bold');
            pdf.text('Grand Total Sales:', margin + 5, yPosition + 10);
            pdf.setTextColor(0, 100, 0);
            pdf.text(`${reportData.grandTotal.toFixed(2)}`, margin + 60, yPosition + 10);
            pdf.setTextColor(0, 0, 0);
            yPosition += 25;

            if (reportData.comparisonData) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                const change = reportData.comparisonData.percentChange.toFixed(2);
                const changeText = `${change}% ${change >= 0 ? 'increase' : 'decrease'} from previous period`;
                const changeColor = change >= 0 ? [0, 100, 0] : [180, 0, 0];
                pdf.setTextColor(...changeColor);
                pdf.text(changeText, margin, yPosition);
                pdf.setTextColor(0, 0, 0);
                yPosition += 10;
            }

            reportData.salesByCategory.forEach(category => {
                if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
                    pdf.addPage();
                    yPosition = margin;
                }
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, yPosition, usableWidth, 8, 'F');
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`${category.categoryName} Products`, margin + 5, yPosition + 6);
                yPosition += 15;

                const tableData = category.products.map(product => [
                    product.productName,
                    `${product.salesPrice?.toFixed(2) || '0.00'}`,
                    (product.totalPreviousReading || 0).toFixed(2),
                    (product.totalCurrentReading || 0).toFixed(2),
                    (product.totalVolume || 0).toFixed(2),
                    `${product.totalAmount?.toFixed(2) || '0.00'}`
                ]);
                tableData.push([
                    'Subtotal',
                    '',
                    '',
                    '',
                    (category.subtotalVolume || 0).toFixed(2),
                    `${(category.subtotalAmount || 0).toFixed(2)}`
                ]);

                autoTable(pdf, {
                    startY: yPosition,
                    head: [['Product', 'Price (PKR)', 'Previous Reading', 'Current Reading', 'Volume (L)', 'Total (PKR)']],
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

            if (dipChartData.length > 0) {
                if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
                    pdf.addPage();
                    yPosition = margin;
                }
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, yPosition, usableWidth, 8, 'F');
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Dip Chart & Inventory Data', margin + 5, yPosition + 6);
                yPosition += 15;

                const dipChartTableData = dipChartData.map(record => {
                    const tank = tanks.find(t => t.id === record.tankId);
                    const tankName = tank ? tank.tankName : 'Unknown';
                    const remainingStock = tank ? Number(tank.remainingStock) : 0;
                    const discrepancy = remainingStock - record.dipLiters;
                    const loss = discrepancy > 0 ? discrepancy : 0;
                    let recordedAtStr = '-';
                    if (record.recordedAt) {
                        if (record.recordedAt instanceof Date) {
                            recordedAtStr = record.recordedAt.toLocaleString();
                        } else if (typeof record.recordedAt.toDate === 'function') {
                            recordedAtStr = record.recordedAt.toDate().toLocaleString();
                        } else if (typeof record.recordedAt === 'string') {
                            recordedAtStr = new Date(record.recordedAt).toLocaleString();
                        }
                    }
                    return [
                        tankName,
                        record.dipMm,
                        record.dipLiters,
                        remainingStock.toFixed(2),
                        discrepancy.toFixed(2),
                        loss.toFixed(2),
                        recordedAtStr
                    ];
                });

                autoTable(pdf, {
                    startY: yPosition,
                    head: [['Tank', 'Dip (mm)', 'Volume (L)', 'Book Stock (L)', 'Discrepancy (L)', 'Loss (L)', 'Recorded Date/Time']],
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
                            cellCreator: (cell) => {
                                const value = parseFloat(cell.text);
                                if (value > 0) cell.styles.textColor = [200, 0, 0];
                                else if (value < 0) cell.styles.textColor = [0, 128, 0];
                                return cell;
                            }
                        },
                        5: {
                            cellCreator: (cell) => {
                                const value = parseFloat(cell.text);
                                if (value > 0) cell.styles.textColor = [200, 0, 0];
                                return cell;
                            }
                        }
                    }
                });

                const totalLoss = calculateTotalLoss();
                yPosition = pdf.lastAutoTable.finalY + 10;
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Total Loss (Liters):', margin, yPosition);
                pdf.setTextColor(200, 0, 0);
                pdf.text(totalLoss.toFixed(2), margin + 50, yPosition);
                pdf.setTextColor(0, 0, 0);
            }

            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setDrawColor(200, 200, 200);
                pdf.line(margin, pdf.internal.pageSize.getHeight() - 15, pageWidth - margin, pdf.internal.pageSize.getHeight() - 15);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pdf.internal.pageSize.getHeight() - 10, { align: 'center' });
                pdf.text(`© ${new Date().getFullYear()} ${companyName} - Confidential`, margin, pdf.internal.pageSize.getHeight() - 10);
                const reportId = `REP-${moment().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`;
                pdf.text(`Report ID: ${reportId}`, pageWidth - margin, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
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

    const showReadingModal = () => {
        readingForm.resetFields();
        setIsReadingModalVisible(true);
    };

    const handleNozzleChange = (nozzleId) => {
        const selectedNozzle = nozzles.find(n => n.id === nozzleId);
        if (selectedNozzle) {
            readingForm.setFieldsValue({ previousReading: selectedNozzle.lastReading || 0 });
        }
    };

    const handleReadingSubmit = async (values) => {
        try {
            const { nozzleId, previousReading, currentReading, tankId, newPrice } = values;
            if (currentReading < previousReading) {
                message.error("Current reading must be greater than or equal to previous reading");
                return;
            }
            const salesVolume = currentReading - previousReading;
            const selectedNozzle = nozzles.find(n => n.id === nozzleId);
            if (!selectedNozzle) {
                message.error("Nozzle not found");
                return;
            }
            const product = products.find(p => p.id === selectedNozzle.productId);
            if (!product) {
                message.error("Linked product not found");
                return;
            }
            const selectedTank = tanks.find(t => t.id === tankId);
            if (!selectedTank) {
                message.error("Selected tank not found");
                return;
            }
            if (selectedTank.remainingStock < salesVolume) {
                message.error(`Not enough volume in tank "${selectedTank.tankName}". Available: ${selectedTank.remainingStock}, Required: ${salesVolume}`);
                return;
            }
            const effectivePrice = (newPrice !== undefined && newPrice !== null) ? newPrice : product.salesPrice;
            const salesAmount = salesVolume * effectivePrice;
            await updateDoc(doc(db, "nozzles", nozzleId), {
                lastReading: currentReading,
                totalSales: (selectedNozzle.totalSales || 0) + salesAmount,
                lastUpdated: new Date()
            });
            await addDoc(collection(db, "readings"), {
                nozzleId,
                dispenserId: selectedNozzle.dispenserId,
                productId: selectedNozzle.productId,
                tankId,
                previousReading,
                currentReading,
                salesVolume,
                salesAmount,
                effectivePrice,
                timestamp: new Date()
            });
            if (newPrice !== undefined && newPrice !== null) {
                await updateDoc(doc(db, "products", selectedNozzle.productId), {
                    salesPrice: newPrice,
                    lastUpdated: new Date()
                });
            }
            await updateDoc(doc(db, "tanks", tankId), {
                remainingStock: selectedTank.remainingStock - salesVolume,
                lastUpdated: new Date()
            });
            message.success("Reading recorded successfully");
            setIsReadingModalVisible(false);
            fetchCollectionData();
        } catch (error) {
            message.error("Failed to record reading: " + error.message);
        }
    };

    const showDipChartModal = () => {
        dipChartForm.resetFields();
        setIsDipChartModalVisible(true);
    };

    const handleDipChartSubmit = async (values) => {
        try {
            const { tankId, dipMm, recordedAt } = values;
            const dipLiters = getLiters(dipMm);
            await addDoc(collection(db, "dipcharts"), {
                tankId,
                dipMm,
                dipLiters,
                recordedAt: new Date(recordedAt)
            });
            message.success("Dip chart recorded successfully");
            setIsDipChartModalVisible(false);
            fetchCollectionData();
        } catch (error) {
            message.error("Failed to record dip chart: " + error.message);
        }
    };

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
            title: 'Previous Reading',
            dataIndex: 'totalPreviousReading',
            key: 'totalPreviousReading',
            render: (reading) => (reading || 0).toFixed(2)
        },
        {
            title: 'Current Reading',
            dataIndex: 'totalCurrentReading',
            key: 'totalCurrentReading',
            render: (reading) => (reading || 0).toFixed(2)
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
            title: 'Dip (mm)',
            dataIndex: 'dipMm',
            key: 'dipMm'
        },
        {
            title: 'Volume (liters)',
            dataIndex: 'dipLiters',
            key: 'dipLiters'
        },
        {
            title: 'Book Stock (L)',
            key: 'bookStock',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                return tank ? Number(tank.remainingStock).toFixed(2) : '-';
            }
        },
        {
            title: 'Discrepancy (L)',
            key: 'discrepancy',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                if (!tank) return '-';
                const remainingStock = Number(tank.remainingStock);
                const discrepancy = remainingStock - record.dipLiters;
                const color = discrepancy > 0 ? 'red' : discrepancy < 0 ? 'green' : 'black';
                return <span style={{ color }}>{discrepancy.toFixed(2)}</span>;
            }
        },
        {
            title: 'Gain/Loss (L)',
            key: 'gainLoss',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                if (!tank) return '-';
                const gainLoss = record.dipLiters - Number(tank.remainingStock);
                const color = gainLoss >= 0 ? 'green' : 'red';
                return <span style={{ color }}>{gainLoss.toFixed(2)}</span>;
            },
            sorter: (a, b) => {
                const tankA = tanks.find(t => t.id === a.tankId);
                const tankB = tanks.find(t => t.id === b.tankId);
                const gainLossA = a.dipLiters - (tankA ? Number(tankA.remainingStock) : 0);
                const gainLossB = b.dipLiters - (tankB ? Number(tankB.remainingStock) : 0);
                return gainLossA - gainLossB;
            }
        },
        {
            title: 'Recorded Date/Time',
            dataIndex: 'recordedAt',
            key: 'recordedAt',
            render: (date) => {
                if (date instanceof Date) {
                    return date.toLocaleString();
                } else if (date && typeof date.toDate === 'function') {
                    return date.toDate().toLocaleString();
                } else if (typeof date === 'string') {
                    return new Date(date).toLocaleString();
                } else {
                    return '-';
                }
            }
        }
    ];

    const calculateTotalLoss = () => {
        return dipChartData.reduce((total, record) => {
            const tank = tanks.find(t => t.id === record.tankId);
            if (!tank) return total;
            const remainingStock = Number(tank.remainingStock);
            const discrepancy = remainingStock - record.dipLiters;
            const loss = discrepancy > 0 ? discrepancy : 0;
            return total + loss;
        }, 0);
    };

    return (
        <Card className="sales-report-container">
            <div className="report-header" style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={8}>
                        <TitleTypography level={3}>Sales Reports</TitleTypography>
                    </Col>
                    <Col xs={24} md={16}>
                        <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button type="primary" onClick={showReadingModal}>
                                Record Reading
                            </Button>
                            <Button type="primary" onClick={showDipChartModal}>
                                Record Dip Chart
                            </Button>
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

            <div id="report-content" ref={reportRef}>
                <Spin spinning={loading}>
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
                                        <Table.Summary.Cell index={2}></Table.Summary.Cell>
                                        <Table.Summary.Cell index={3}></Table.Summary.Cell>
                                        <Table.Summary.Cell index={4}><strong>{(category.subtotalVolume || 0).toFixed(2)}</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={5}><strong>₨{(category.subtotalAmount || 0).toFixed(2)}</strong></Table.Summary.Cell>
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

                    <Divider orientation="center">Dip Chart Data</Divider>
                    <Table
                        columns={dipChartColumns}
                        dataSource={dipChartData}
                        rowKey="id"
                        pagination={false}
                        bordered
                    />
                    <Divider orientation="center">Total Loss</Divider>
                    <Row style={{ marginBottom: 30 }}>
                        <Col span={12}>
                            <Statistic
                                title="Total Loss (Liters)"
                                value={calculateTotalLoss()}
                                precision={2}
                            />
                        </Col>
                    </Row>
                </Spin>
            </div>

            <Modal
                title="Record Reading"
                visible={isReadingModalVisible}
                onCancel={() => setIsReadingModalVisible(false)}
                footer={null}
            >
                <Form
                    form={readingForm}
                    layout="vertical"
                    onFinish={handleReadingSubmit}
                >
                    <Form.Item
                        name="nozzleId"
                        label="Select Nozzle"
                        rules={[{ required: true, message: 'Please select a nozzle' }]}
                    >
                        <Select placeholder="Select nozzle" onChange={handleNozzleChange}>
                            {nozzles.map(nozzle => (
                                <Option key={nozzle.id} value={nozzle.id}>
                                    {nozzle.nozzleName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="previousReading"
                        label="Previous Reading"
                    >
                        <InputNumber disabled style={{ width: '100%' }} placeholder="Auto-filled" />
                    </Form.Item>
                    <Form.Item
                        name="currentReading"
                        label="Current Reading"
                        rules={[{ required: true, message: 'Please enter current reading' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter current reading" />
                    </Form.Item>
                    <Form.Item
                        name="tankId"
                        label="Select Tank"
                        rules={[{ required: true, message: 'Please select a tank' }]}
                    >
                        <Select placeholder="Select tank">
                            {tanks.map(tank => (
                                <Option key={tank.id} value={tank.id}>
                                    {tank.tankName} (Available: {tank.remainingStock || 0})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="newPrice"
                        label="New Product Price (PKR) - optional"
                    >
                        <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            placeholder="Enter new product price if updating"
                        />
                    </Form.Item>
                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={() => setIsReadingModalVisible(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit">Record Reading</Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Record Dip Chart Entry"
                visible={isDipChartModalVisible}
                onCancel={() => setIsDipChartModalVisible(false)}
                footer={null}
            >
                <Form
                    form={dipChartForm}
                    layout="vertical"
                    onFinish={handleDipChartSubmit}
                    onValuesChange={(changedValues) => {
                        if (changedValues.dipMm !== undefined) {
                            const computedLiters = getLiters(changedValues.dipMm);
                            dipChartForm.setFieldsValue({ dipLiters: computedLiters });
                        }
                    }}
                >
                    <Form.Item
                        name="tankId"
                        label="Select Tank"
                        rules={[{ required: true, message: 'Please select a tank' }]}
                    >
                        <Select placeholder="Select tank">
                            {tanks.map(tank => (
                                <Option key={tank.id} value={tank.id}>
                                    {tank.tankName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="dipMm"
                        label="Dip (mm)"
                        rules={[{ required: true, message: 'Please enter dip in mm' }]}
                    >
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="Enter dip in mm" />
                    </Form.Item>
                    <Form.Item
                        name="dipLiters"
                        label="Volume (liters)"
                        rules={[{ required: true, message: 'Volume is required' }]}
                    >
                        <InputNumber disabled style={{ width: '100%' }} placeholder="Auto-computed volume" />
                    </Form.Item>
                    <Form.Item
                        name="recordedAt"
                        label="Recorded Date/Time"
                        rules={[{ required: true, message: 'Please select date/time' }]}
                    >
                        <Input type="datetime-local" />
                    </Form.Item>
                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={() => setIsDipChartModalVisible(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit">Record Dip Chart</Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default SalesReportPage;