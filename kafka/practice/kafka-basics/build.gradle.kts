plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

// исходники лежат прямо в папке kafka-basics, без src/main/java и без пакетов
sourceSets {
    main {
        java.setSrcDirs(listOf("."))
        resources.setSrcDirs(emptyList<String>())
    }
    test {
        java.setSrcDirs(emptyList<String>())
        resources.setSrcDirs(emptyList<String>())
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.apache.kafka:kafka-clients:4.3.1")   // та же версия, что у брокера в Docker
    implementation("org.slf4j:slf4j-simple:2.0.17")          // логи клиента в консоль
}
