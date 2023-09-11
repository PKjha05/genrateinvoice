import axios from 'axios'
import express from 'express'
import AWS from 'aws-sdk'
import fs from 'fs'
import cors from 'cors'


const app = express()
app.use(express.json())
app.use(cors());


app.post("/generateInvoice", async (req, res) => {
    try {

        const { code } = req.body;
        console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<1930>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", code);
        const tokenResponse = await axios({
            method: 'get',
            url: 'https://jhakaashul.unicommerce.com/oauth/token?grant_type=password&client_id=my-trusted-client&username=rajni@ens.enterprises&password=Uni@12345',
            headers: {
                'Content-Type': 'application/json',
            },
        });


        const token = tokenResponse.data.access_token;
        const facility = 'Bangalore-WH';

        const getOrderUrl = 'https://jhakaashul.unicommerce.com/services/rest/v1/oms/saleorder/get';
        const orderRequestBody = { code }

        const orderResponse = await axios.post(getOrderUrl, orderRequestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'bearer' + token,
                'Facility': facility,
            },
        });
        console.log("line1944>>>>>>>>>>>>>>>>>>", orderResponse.data);

        if (orderResponse.data.saleOrderDTO === null || undefined) {
            console.log("order is not fulfilled")
            res.status(201).json("")
        } else {
            const shippingPackages = orderResponse.data.saleOrderDTO.shippingPackages;

            const s3 = new AWS.S3({
                accessKeyId: 'AKIAYJUL5VJOBYQMJDT7',
                secretAccessKey: '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',
                region: 'ap-south-1',
            });
            // calling the pdf generate api
            const invoiceCode = shippingPackages[0].invoiceCode;
            const getInvoiceUrl = `https://jhakaashul.unicommerce.com/services/rest/v1/oms/invoice/show?invoiceCodes=${invoiceCode}`;


            const response = await axios.get(getInvoiceUrl, {
                headers: {
                    'Facility': facility,
                    'Authorization': 'bearer' + token,
                    'Content-Type': 'application/json',
                    'Cookie': 'unicommerce=app1'
                },
                responseType: 'arraybuffer',
            });

            const pdfData = response.data;

            const filename = `invoice_${invoiceCode}.pdf`;
            console.log(filename);

            await s3.upload({
                Bucket: 'testing-01/ushopinvoice',
                Key: filename,
                Body: pdfData,
            }).promise();
            const bucketName = 'testing-01/ushopinvoice';

            const params = {
                Bucket: bucketName,
                Key: filename,
                Expires: 3600,
            };

            const presignedUrl = s3.getSignedUrl('getObject', params);
            console.log('All invoices saved to S3 successfully.');
            console.log(`Invoice PDF saved to S3 as ${filename}`);
            console.log('Presigned URL for the image:', presignedUrl);
            res.status(200).json(presignedUrl)
        }


    } catch (error) {
        console.log(error);
        res.status(400).json({ status: false, message: "failed to save invoice" });
    }
})

const port = 6000;

app.listen(port, () => {
    console.log(`server is running on ${port}`)
})
