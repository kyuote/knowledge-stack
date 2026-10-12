plugins {
    // позволяет Gradle самому скачать JDK 21 для toolchain, если её нет
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "kafka-basics"
