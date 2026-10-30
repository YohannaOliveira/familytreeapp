package br.familytree;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(br.familytree.photo.PhotoProperties.class)
public class FamilyTreeApplication {
    public static void main(String[] args) {
        SpringApplication.run(FamilyTreeApplication.class, args);
    }
}
