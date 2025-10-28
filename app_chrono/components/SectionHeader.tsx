import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface SectionHeaderProps {
title: string;
showSeeMore?: boolean;
onSeeMorePress?: () => void;
}

export default function SectionHeader({ 
title, 
showSeeMore = true, 
onSeeMorePress 
}: SectionHeaderProps) {
return (
    <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {showSeeMore && (
        <TouchableOpacity onPress={onSeeMorePress}>
        <Text style={styles.viewMore}>Voir plus</Text>
        </TouchableOpacity>
    )}
    </View>
);
}

const styles = StyleSheet.create({
sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 25,
},
sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
},
viewMore: {
    fontSize: 14,
    color: "#c1c1c1ff",
    fontWeight: "600",
},
});