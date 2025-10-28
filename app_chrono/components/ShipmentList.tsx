import React from "react";
import { View } from "react-native";
import ShipmentCard from "./ShipmentCard";


const shipmentsData = [
{
    id: "H326397405",
    productName: "Mac book M5 Pro",
    productIcon: require("../assets/images/15625f172ee5f194b50de81e0de6038e22c0fc5f.jpeg"), 
    backgroundColor: "#E5D5FF",
    transportIcon: require("../assets/images/imgdelivery1.png"),
    location: "Deux plateaux",
    deliveryTime: "50 min",
    progressPercentage: 65,
    progressColor: "#8B5CF6",
},
{
    id: "H521397435",
    productName: "iPhone Air ",
    productIcon: require("../assets/images/Apple-iPhone-Air-Sky-Blue-1.webp"), 
    backgroundColor: "#E8F0F4",
    transportIcon: require("../assets/images/imgdelivery2.png"),
    location: "Marcory Zone 4",
    deliveryTime: "50 min",
    progressPercentage: 40,
    progressColor: "#999",
},
];

export default function ShipmentList() {
return (
    <View>
    {shipmentsData.map((shipment, index) => (
        <ShipmentCard
        key={index}
        id={shipment.id}
        productName={shipment.productName}
        productIcon={shipment.productIcon}
        backgroundColor={shipment.backgroundColor}
        transportIcon={shipment.transportIcon}
        location={shipment.location}
        deliveryTime={shipment.deliveryTime}
        progressPercentage={shipment.progressPercentage}
        progressColor={shipment.progressColor}
        />
))}
    </View>
);
}