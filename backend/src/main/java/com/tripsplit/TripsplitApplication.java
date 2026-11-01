package com.tripsplit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TripsplitApplication {
    public static void main(String[] args) {
        SpringApplication.run(TripsplitApplication.class, args);
    }
}
